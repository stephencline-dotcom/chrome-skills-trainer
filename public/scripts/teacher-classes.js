const TEACHER_TOKEN_KEY = 'chromeSkillsTeacherToken';

let classes = [];
let selectedClassId = null;

function getTeacherToken() {
  return localStorage.getItem(TEACHER_TOKEN_KEY);
}

function redirectToTeacherLogin() {
  const next =
    window.location.pathname +
    window.location.search;

  window.location.replace(
    `/teacher-login.html?next=${encodeURIComponent(next)}`
  );
}

async function requireTeacherSession() {
  const token = getTeacherToken();

  if (!token) {
    redirectToTeacherLogin();
    return false;
  }

  try {
    const response = await fetch(
      '/api/teacher-session',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (response.ok) {
      const result = await response.json();

      if (result.authenticated) {
        return true;
      }
    }
  } catch (error) {
    console.error(
      'Unable to verify teacher session:',
      error
    );
  }

  localStorage.removeItem(TEACHER_TOKEN_KEY);
  redirectToTeacherLogin();
  return false;
}

async function teacherFetch(url, options = {}) {
  const token = getTeacherToken();

  if (!token) {
    redirectToTeacherLogin();
    throw new Error('Teacher sign-in required.');
  }

  const headers = {
    ...(options.body
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  const response = await fetch(
    url,
    {
      ...options,
      headers,
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    localStorage.removeItem(TEACHER_TOKEN_KEY);
    redirectToTeacherLogin();
    throw new Error('Teacher session expired.');
  }

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error ||
      'Unable to complete request.'
    );
  }

  return result;
}

async function signOutTeacher() {
  const token = getTeacherToken();

  try {
    if (token) {
      await fetch(
        '/api/teacher-logout',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
    }
  } catch (error) {
    console.error(
      'Unable to sign out:',
      error
    );
  }

  localStorage.removeItem(TEACHER_TOKEN_KEY);
  window.location.replace('/teacher-login.html');
}

function selectedClass() {
  return classes.find(
    item => item.id === selectedClassId
  ) || null;
}

function setMessage(element, text, isError = false) {
  if (!element) return;

  element.textContent = text || '';
  element.classList.toggle(
    'is-error',
    !!isError
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildClassLink(item) {
  if (!item?.code) return '';

  const url =
    new URL(
      '/student.html',
      window.location.origin
    );

  url.searchParams.set(
    'skill',
    'quick-chrome-assessment'
  );

  url.searchParams.set(
    'lesson',
    'active'
  );

  url.searchParams.set(
    'class',
    item.code
  );

  return url.toString();
}

async function copySelectedClassLink() {
  const item = selectedClass();

  if (!item) return;

  const link =
    buildClassLink(item);

  const message =
    document.getElementById(
      'class-link-message'
    );

  try {
    await navigator.clipboard.writeText(
      link
    );

    setMessage(
      message,
      'Class link copied!'
    );
  } catch {
    const input =
      document.getElementById(
        'class-link-value'
      );

    input?.focus();
    input?.select();

    document.execCommand('copy');

    setMessage(
      message,
      'Class link copied!'
    );
  }
}
async function activateAssessmentClass(classId) {
  selectedClassId = Number(classId);

  renderAll();

  try {
  } catch (error) {
    console.error(
      'Unable to select assessment class:',
      error
    );

    window.alert(
      'Could not select this class. Please try again.'
    );
  }
}
function renderClassList() {
  const list = document.getElementById('class-list');
  if (!list) return;

  if (!classes.length) {
    list.innerHTML =
      '<p class="classes-empty">No classes yet.</p>';
    return;
  }

  list.innerHTML = classes
    .map(item => {
      const completed =
        item.students.filter(
          student => student.score !== null
        ).length;

      return `
        <button
          type="button"
          class="class-list-button ${item.id === selectedClassId ? 'is-selected' : ''}"
          data-class-id="${item.id}"
        >
          <span class="class-list-name">
            ${escapeHtml(item.name)}
          </span>
          <span class="class-list-meta">
            ${item.students.length} students
            • ${completed} complete
          </span>
        </button>
      `;
    })
    .join('');

  list.querySelectorAll(
    '[data-class-id]'
  ).forEach(button => {
    button.addEventListener(
      'click',
      () => {
        activateAssessmentClass(
          Number(button.dataset.classId)
        );
      }
    );
  });
}

async function deleteSelectedClass() {
  const item = selectedClass();

  if (!item) return;

  const confirmed =
    window.confirm(
      `Delete "${item.name}"? This will also remove its students and assessment results.`
    );

  if (!confirmed) return;

  try {
    await teacherFetch(
      `/api/assessment-classes/${item.id}`,
      {
        method: 'DELETE'
      }
    );

    selectedClassId = null;

    await loadClasses();
  } catch (error) {
    window.alert(error.message);
  }
}

async function editStudent(studentId) {
  const item = selectedClass();

  if (!item) return;

  const student =
    item.students.find(
      entry =>
        entry.id === Number(studentId)
    );

  if (!student) return;

  const nextName =
    window.prompt(
      'Edit student name:',
      student.name
    );

  if (nextName === null) return;

  const name = nextName.trim();

  if (!name) {
    window.alert(
      'Enter a student name.'
    );
    return;
  }

  try {
    await teacherFetch(
      `/api/assessment-classes/${item.id}/students/${student.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          name
        })
      }
    );

    await loadClasses();
  } catch (error) {
    window.alert(error.message);
  }
}

async function deleteStudent(studentId) {
  const item = selectedClass();

  if (!item) return;

  const student =
    item.students.find(
      entry =>
        entry.id === Number(studentId)
    );

  if (!student) return;

  const confirmed =
    window.confirm(
      `Delete ${student.name} from this class?`
    );

  if (!confirmed) return;

  try {
    await teacherFetch(
      `/api/assessment-classes/${item.id}/students/${student.id}`,
      {
        method: 'DELETE'
      }
    );

    await loadClasses();
  } catch (error) {
    window.alert(error.message);
  }
}
function renderResults(item) {
  const tbody =
    document.getElementById(
      'results-body'
    );

  if (!tbody) return;

  if (!item.students.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="result-pending"
        >
          No students have joined this class yet.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    item.students
      .map(student => {
        const complete =
          student.score !== null;

        const scoreText =
          complete
            ? `${student.score} / 10`
            : '—';

        const percentText =
          complete
            ? `${student.score * 10}%`
            : '—';

        return `
          <tr>
            <td>
              ${escapeHtml(student.name)}
            </td>

            <td class="result-score">
              ${scoreText}
            </td>

            <td>
              ${percentText}
            </td>

            <td class="${
              complete
                ? 'result-complete'
                : 'result-pending'
            }">
              ${
                complete
                  ? 'Complete'
                  : 'Not completed'
              }
            </td>

            <td class="student-actions">
              <button
                type="button"
                class="student-edit-btn"
                data-edit-student-id="${student.id}"
              >
                Edit
              </button>

              <button
                type="button"
                class="student-delete-btn"
                data-delete-student-id="${student.id}"
              >
                Delete
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

  tbody
    .querySelectorAll(
      '[data-edit-student-id]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          editStudent(
            Number(
              button.dataset.editStudentId
            )
          );
        }
      );
    });

  tbody
    .querySelectorAll(
      '[data-delete-student-id]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          deleteStudent(
            Number(
              button.dataset.deleteStudentId
            )
          );
        }
      );
    });
}

function renderDetail() {
  const item = selectedClass();

  const emptyState =
    document.getElementById(
      'class-empty-state'
    );

  const content =
    document.getElementById(
      'class-detail-content'
    );

  if (!item) {
    if (emptyState) emptyState.hidden = false;
    if (content) content.hidden = true;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (content) content.hidden = false;

  document.getElementById(
    'class-name-input'
  ).value = item.name;

  document.getElementById(
    'class-link-value'
  ).value = buildClassLink(item);

  renderResults(item);
}

function renderAll() {
  renderClassList();
  renderDetail();
}

async function loadClasses() {
  const result = await teacherFetch(
    '/api/assessment-classes'
  );

  classes = Array.isArray(result.classes)
    ? result.classes
    : [];

  if (
    selectedClassId !== null &&
    !classes.some(item =>
      item.id === selectedClassId
    )
  ) {
    selectedClassId = null;
  }

  renderAll();
}

async function createClass() {
  const input =
    document.getElementById(
      'new-class-name'
    );

  const message =
    document.getElementById(
      'class-create-message'
    );

  const name = input.value.trim();

  if (!name) {
    setMessage(
      message,
      'Enter a class name.',
      true
    );
    return;
  }

  try {
    const item = await teacherFetch(
      '/api/assessment-classes',
      {
        method: 'POST',
        body: JSON.stringify({ name })
      }
    );

    input.value = '';
    selectedClassId = item.id;


    setMessage(
      message,
      `Created ${item.name}.`
    );

    await loadClasses();
  } catch (error) {
    setMessage(
      message,
      error.message,
      true
    );
  }
}

async function renameClass() {
  const item = selectedClass();
  if (!item) return;

  const input =
    document.getElementById(
      'class-name-input'
    );

  const name = input.value.trim();

  if (!name) return;

  try {
    await teacherFetch(
      `/api/assessment-classes/${item.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ name })
      }
    );

    await loadClasses();
  } catch (error) {
    window.alert(error.message);
  }
}

function attachEvents() {
  document.getElementById(
    'create-class-btn'
  )?.addEventListener(
    'click',
    createClass
  );

  document.getElementById(
    'new-class-name'
  )?.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Enter') {
        createClass();
      }
    }
  );

  document.getElementById(
    'copy-class-link-btn'
  )?.addEventListener(
    'click',
    copySelectedClassLink
  );
  document.getElementById(
    'delete-class-btn'
  )?.addEventListener(
    'click',
    deleteSelectedClass
  );
  document.getElementById(
    'rename-class-btn'
  )?.addEventListener(
    'click',
    renameClass
  );



  document.getElementById(
    'refresh-results'
  )?.addEventListener(
    'click',
    loadClasses
  );

  document.getElementById(
    'print-results-btn'
  )?.addEventListener(
    'click',
    () => window.print()
  );

  document.getElementById(
    'teacher-sign-out'
  )?.addEventListener(
    'click',
    signOutTeacher
  );
}

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    const authenticated =
      await requireTeacherSession();

    if (!authenticated) return;

    attachEvents();

    try {
      await loadClasses();
    } catch (error) {
      console.error(
        'Unable to load assessment classes:',
        error
      );
    }
  }
);

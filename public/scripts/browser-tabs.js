/**
 * Shared simulated tabs. Each tab owns its page history and reload count.
 * Real browser tabs are never opened or closed.
 */
export class BrowserTabs {
  constructor({ browserNavigator, windowManager, strip }) {
    this.navigator = browserNavigator;
    this.windowManager = windowManager;
    this.strip = strip;
    this.tabs = [];
    this.activeId = null;
    this.nextId = 1;
  }

  snapshot() {
    return {
      history: [...this.navigator.history],
      historyIndex: this.navigator.historyIndex,
      reloadCount: this.navigator.reloadCount || 0,
      scrollTop: this.navigator.contentElement.scrollTop
    };
  }

  saveActive() {
    const tab = this.tabs.find(item => item.id === this.activeId);
    if (tab) Object.assign(tab, this.snapshot());
  }

  resetFromBrowser() {
    const tab = { id: String(this.nextId++), ...this.snapshot() };
    this.tabs = [tab];
    this.activeId = tab.id;
    this.render();
  }

  init() {
    if (!this.strip) throw new Error('Missing browser tab strip.');
    this.navigator.tabs = this;
    this.strip.classList.add('interactive-tabstrip');
    this.strip.setAttribute('aria-label', 'Browser tabs');

    // Tab clicks must not drag or maximize the containing window.
    this.strip.addEventListener('pointerdown', event => event.stopPropagation());
    this.strip.addEventListener('dblclick', event => event.stopPropagation());
    this.strip.addEventListener('click', event => {
      const button = event.target.closest('button[data-tab-action]');
      if (!button || !this.strip.contains(button)) return;
      event.stopPropagation();

      const action = button.dataset.tabAction;
      const id = button.dataset.tabId;
      if (action === 'new') this.newTab();
      if (action === 'switch') this.switchTab(id);
      if (action === 'close') this.closeTab(id);
    });

    const content = this.navigator.contentElement;
    content.addEventListener('browser:rendered', () => {
      this.saveActive();
      this.render();
    });
    content.addEventListener('browser:reset', () => this.resetFromBrowser());
    content.addEventListener('browser:permissions-changed', () => this.render());
    this.resetFromBrowser();
  }

  resetTabs(pages = ['home'], activeIndex = 0) {
    const valid = pages.filter(page => this.navigator.getPage(page)).slice(0, 6);
    this.tabs = (valid.length ? valid : ['home']).map(page => ({
      id: String(this.nextId++),
      history: [page],
      historyIndex: 0,
      reloadCount: 0,
      scrollTop: 0
    }));
    this.activate(this.tabs[Math.max(0, Math.min(activeIndex, this.tabs.length - 1))]);
  }

  attempt(control, action, tabId, available = true) {
    const allowed = this.navigator.canUse(control) && available;
    const event = this.navigator.dispatch('browser:control-attempt', {
      control, action, tabId, allowed,
      pageId: (() => {
        const tab = this.tabs.find(item => item.id === tabId);
        return tab?.history[tab.historyIndex];
      })()
    });
    return allowed && !event.defaultPrevented;
  }

  newTab() {
    if (!this.attempt('btn-new-tab', 'new-tab', null, this.tabs.length < 6)) return;
    this.saveActive();
    const tab = {
      id: String(this.nextId++),
      history: ['home'],
      historyIndex: 0,
      reloadCount: 0,
      scrollTop: 0
    };
    this.tabs.push(tab);
    this.activate(tab);
    this.navigator.dispatch('browser:tab-opened', {
      control: 'btn-new-tab', action: 'new-tab', tabId: tab.id
    });
  }

  switchTab(id) {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab || id === this.activeId) return;
    if (!this.attempt('btn-switch-tab', 'switch-tab', id)) return;
    this.saveActive();
    this.activate(tab);
    this.navigator.dispatch('browser:tab-switched', {
      control: 'btn-switch-tab', action: 'switch-tab',
      tabId: id, pageId: this.navigator.currentPageId
    });
  }

  activate(tab) {
    this.activeId = tab.id;
    this.navigator.history = [...tab.history];
    this.navigator.historyIndex = tab.historyIndex;
    this.navigator.reloadCount = tab.reloadCount;
    const scrollTop = tab.scrollTop;
    this.navigator.render();
    this.navigator.contentElement.scrollTop = scrollTop;
    tab.scrollTop = scrollTop;
  }

  closeTab(id) {
    const index = this.tabs.findIndex(item => item.id === id);
    if (index < 0 || !this.attempt('btn-close-tab', 'close-tab', id)) return;
    this.saveActive();
    const closedPageId = this.tabs[index].history[this.tabs[index].historyIndex];

    if (this.tabs.length === 1) {
      // Closing the last tab closes the simulated window.
      // Prepare a fresh page for taskbar reopening.
      this.navigator.reset(['home'], 0);
      this.windowManager.close();
    } else {
      const wasActive = id === this.activeId;
      this.tabs.splice(index, 1);
      if (wasActive) {
        this.activate(this.tabs[Math.min(index, this.tabs.length - 1)]);
      } else {
        this.render();
      }
    }

    this.navigator.dispatch('browser:tab-closed', {
      control: 'btn-close-tab', action: 'close-tab', tabId: id,
      pageId: closedPageId
    });
  }

  title(tab) {
    const pageId = tab.history[tab.historyIndex];
    const page = this.navigator.getPage(pageId);
    const template = document.createElement('template');
    template.innerHTML = page?.html || '';
    return template.content.querySelector('h2')?.textContent || 'Learning Home';
  }

  render() {
    const focused = this.strip.contains(document.activeElement)
      ? {
          action: document.activeElement.dataset.tabAction,
          id: document.activeElement.dataset.tabId
        }
      : null;

    this.strip.replaceChildren();
    const list = document.createElement('div');
    list.className = 'browser-tabs-list';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Open pages');

    this.tabs.forEach(tab => {
      const active = tab.id === this.activeId;
      const title = this.title(tab);
      const wrapper = document.createElement('div');
      wrapper.className = 'browser-tab-item' + (active ? ' is-active' : '');

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'browser-tab-select';
      select.dataset.tabAction = 'switch';
      select.dataset.tabId = tab.id;
      select.dataset.simulatorControl = active ? 'active-tab' : 'switch-tab';
      select.setAttribute('aria-pressed', String(active));
      select.title = title;
      select.textContent = title;
      select.disabled = !this.navigator.canUse('btn-switch-tab');

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'browser-tab-close';
      close.dataset.tabAction = 'close';
      close.dataset.tabId = tab.id;
      close.dataset.simulatorControl = active ? 'close-tab' : 'close-other-tab';
      close.setAttribute('aria-label', 'Close tab: ' + title);
      close.title = 'Close tab';
      close.textContent = '×';
      close.disabled = !this.navigator.canUse('btn-close-tab');

      wrapper.append(select, close);
      list.append(wrapper);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'browser-tab-add';
    add.id = 'btn-new-tab';
    add.dataset.tabAction = 'new';
    add.dataset.simulatorControl = 'new-tab';
    add.textContent = '+';
    add.setAttribute('aria-label', 'New tab');
    add.title = this.tabs.length >= 6 ? 'Practice limit: six tabs' : 'New tab';
    add.disabled = !this.navigator.canUse('btn-new-tab') || this.tabs.length >= 6;
    this.strip.append(list, add);

    if (focused) {
      const replacement = [...this.strip.querySelectorAll('button')].find(
        button => button.dataset.tabAction === focused.action &&
          button.dataset.tabId === focused.id
      );
      (replacement || this.strip.querySelector('.is-active button'))?.focus({
        preventScroll: true
      });
    }

    list.querySelector('.is-active')?.scrollIntoView({
      block: 'nearest', inline: 'nearest'
    });
  }
}

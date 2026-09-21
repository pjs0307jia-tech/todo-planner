let inlineEditSession = null;

function inlineEditActive() {
  return Boolean(inlineEditSession);
}

window.todoInlineEditActive = inlineEditActive;

const _renderAllInlineGuard = renderAll;
renderAll = function() {
  // 자동 동기화/주기적 렌더링이 수정창을 없애지 못하게 막는다.
  if (inlineEditActive()) return;
  return _renderAllInlineGuard.apply(this, arguments);
};

function scheduleCloudRefreshAfterEdit(delay) {
  setTimeout(() => {
    if (inlineEditActive()) return;
    if (typeof window.todoPullLatest === 'function') {
      window.todoPullLatest(true);
    }
  }, delay);
}

function startInlineEdit(target, currentText, onSave) {
  if (!target) return;

  // 한 번에 하나만 수정한다. 이미 수정 중이면 기존 입력창으로 포커스를 돌린다.
  if (inlineEditSession) {
    inlineEditSession.input?.focus();
    return;
  }

  const editor = document.createElement('div');
  editor.className = 'inline-edit-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit-input';
  input.value = currentText;
  input.maxLength = target.closest('.event-item') ? 42 : 80;
  input.setAttribute('aria-label', '내용 수정');
  input.setAttribute('autocomplete', 'off');

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'inline-edit-save';
  saveBtn.textContent = '저장';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'inline-edit-cancel';
  cancelBtn.textContent = '취소';

  editor.append(input, saveBtn, cancelBtn);

  const parent = target.parentNode;
  const row = target.closest('.todo-item, .event-item');
  if (!parent) return;

  row?.classList.add('is-inline-editing');
  parent.replaceChild(editor, target);

  inlineEditSession = { editor, input, row };
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let finished = false;
  const finish = (save) => {
    if (finished) return;

    const next = input.value.trim();
    if (save && !next) {
      input.classList.add('invalid');
      input.focus();
      return;
    }

    finished = true;
    inlineEditSession = null;

    try {
      if (save && next !== currentText) onSave(next);
    } finally {
      // 저장/취소 버튼을 누른 뒤에만 수정창을 닫는다.
      renderAll();
      scheduleCloudRefreshAfterEdit(save ? 900 : 80);
    }
  };

  const stop = e => e.stopPropagation();
  editor.addEventListener('click', stop);
  editor.addEventListener('pointerdown', stop);
  editor.addEventListener('dblclick', stop);

  input.addEventListener('input', () => input.classList.remove('invalid'));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
      return;
    }

    // Enter는 저장하지 않는다. 모바일 한글 입력/실수로 수정창이 닫히는 일을 막는다.
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  });

  saveBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    finish(true);
  });

  cancelBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    finish(false);
  });

  // blur에서는 아무것도 하지 않는다.
  // 다른 곳을 잘못 눌러도 작성 중인 텍스트와 수정창을 그대로 유지한다.
}

function persistEditedTodo(mode, date, todo) {
  if (!todo?.id || !mode || !date) return;

  // Todo 전체 저장은 sync firewall에서 의도적으로 제외되므로
  // 수정도 체크/추가와 동일하게 item 단위 저장 경로를 반드시 탄다.
  if (typeof window.persistTodoItemToVault === 'function') {
    window.persistTodoItemToVault(mode, date, todo);
  } else {
    const stamp = new Date().toISOString();
    todo._itemUpdatedAt = stamp;
    if (typeof window.todoStatusLedgerRecord === 'function') {
      window.todoStatusLedgerRecord(mode, date, todo, stamp);
    }
    if (typeof window.todoVaultEnqueueUpsert === 'function') {
      window.todoVaultEnqueueUpsert(mode, date, todo, stamp);
    }
    if (typeof window.todoMainAckEnqueueUpsert === 'function') {
      window.todoMainAckEnqueueUpsert(mode, date, todo);
    }
  }

  if (typeof saveLocal === 'function') saveLocal();
  if (typeof queueSave === 'function') queueSave();
  if (typeof window.todoVaultFlushOutbox === 'function') {
    setTimeout(() => window.todoVaultFlushOutbox(), 20);
  }
  if (typeof window.todoMainAckFlush === 'function') {
    setTimeout(() => window.todoMainAckFlush(), 30);
  }
}

function attachTodoEditors() {
  const k = dateKey(selected);
  const arr = modeTodos()[k] || [];

  document.querySelectorAll('.todo-item').forEach((el, index) => {
    const tx = el.querySelector('.todo-text');
    const stableId = String(el.dataset.todoId || '');
    const todo = stableId
      ? arr.find(item => String(item?.id || '') === stableId)
      : arr[index];

    if (!tx || !todo) return;

    tx.classList.add('editable-text');
    tx.title = '더블클릭해서 수정';
    tx.setAttribute('role', 'button');
    tx.setAttribute('tabindex', '0');

    const open = e => {
      e.preventDefault();
      e.stopPropagation();

      startInlineEdit(tx, todo.text, next => {
        todo.text = next;
        persistEditedTodo(activeMode, k, todo);
      });
    };

    tx.addEventListener('dblclick', open);
    tx.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        open(e);
      }
    });
  });
}

function attachEventEditors() {
  const k = dateKey(selected);
  const arr = state.events[k] || [];

  document.querySelectorAll('.event-item').forEach((el, index) => {
    const tx = el.querySelector('span');
    const event = arr[index];
    if (!tx || !event) return;

    tx.classList.add('editable-text');
    tx.title = '더블클릭해서 수정';
    tx.setAttribute('role', 'button');
    tx.setAttribute('tabindex', '0');

    const open = e => {
      e.preventDefault();
      e.stopPropagation();

      startInlineEdit(tx, event.text, next => {
        event.text = next;
        queueSave();
      });
    };

    tx.addEventListener('dblclick', open);
    tx.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        open(e);
      }
    });
  });
}

const _renderTodosEditing = renderTodos;
renderTodos = function() {
  _renderTodosEditing();
  attachTodoEditors();
};

const _renderEventsEditing = renderEvents;
renderEvents = function() {
  _renderEventsEditing();
  attachEventEditors();
};

renderAll();

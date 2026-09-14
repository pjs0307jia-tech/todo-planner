function startInlineEdit(target, currentText, onSave) {
  if (!target || target.dataset.editing === 'true') return;
  target.dataset.editing = 'true';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit-input';
  input.value = currentText;
  input.maxLength = target.closest('.event-item') ? 42 : 80;
  input.setAttribute('aria-label', '내용 수정');

  const parent = target.parentNode;
  parent.replaceChild(input, target);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const next = input.value.trim();
    if (save && next && next !== currentText) onSave(next);
    else renderAll();
  };

  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('pointerdown', e => e.stopPropagation());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
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
    tx.title = '클릭해서 수정';
    tx.setAttribute('role', 'button');
    tx.setAttribute('tabindex', '0');
    const open = e => {
      e.stopPropagation();
      startInlineEdit(tx, todo.text, next => {
        todo.text = next;
        persistEditedTodo(activeMode, k, todo);
        renderAll();
      });
    };
    tx.addEventListener('click', open);
    tx.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
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
    tx.title = '클릭해서 수정';
    tx.setAttribute('role', 'button');
    tx.setAttribute('tabindex', '0');
    const open = e => {
      e.stopPropagation();
      startInlineEdit(tx, event.text, next => {
        event.text = next;
        queueSave();
        renderAll();
      });
    };
    tx.addEventListener('click', open);
    tx.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
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

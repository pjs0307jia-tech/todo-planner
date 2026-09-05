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

function attachTodoEditors() {
  const k = dateKey(selected);
  const arr = modeTodos()[k] || [];
  document.querySelectorAll('.todo-item').forEach((el, index) => {
    const tx = el.querySelector('.todo-text');
    const todo = arr[index];
    if (!tx || !todo) return;
    tx.classList.add('editable-text');
    tx.title = '클릭해서 수정';
    tx.setAttribute('role', 'button');
    tx.setAttribute('tabindex', '0');
    const open = e => {
      e.stopPropagation();
      startInlineEdit(tx, todo.text, next => {
        todo.text = next;
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

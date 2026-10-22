// ============================================================
// URL веб-приложения
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzUm-PXBXoSORZEc2Vy4GIdTe7Jt1bHL3lVbRjmZy6IFQ9O76FhR7Ry6381o3GwPqBtEA/exec';

// ============================================================
// Текущее действие: 'income' или 'withdraw'
// ============================================================
let currentAction = null;
let isProcessing = false;

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Безопасно получает JSON из ответа.
 * Бросает понятную ошибку, если сервер вернул не JSON
 * (например, HTML-страницу авторизации Google).
 */
async function fetchJson_(url, options) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await response.text();
        // Обрезаем, чтобы не засорять alert огромным HTML
        const preview = text.slice(0, 200).replace(/\s+/g, ' ');
        throw new Error(
            `Сервер вернул не JSON (${contentType || 'без content-type'}). ` +
            `Проверьте доступ "Все" у веб-приложения. Ответ: ${preview}`
        );
    }

    return response.json();
}

/**
 * Форматирует число как "1 234.56".
 */
function fmt_(value) {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Ищет строку, в любой колонке которой есть точное совпадение с label.
 * Возвращает { rowIndex, colIndex } или null.
 *
 * Пример: findIndicator_(data, 'Баланс')
 *   → { rowIndex: 9, colIndex: 1 }, если в d[9][1] === 'Баланс'
 */
function findIndicator_(data, label) {
    for (let i = 0; i < data.length; i++) {
        const row = data[i] || [];
        for (let j = 0; j < row.length; j++) {
            if (String(row[j] || '').trim() === label) {
                return { rowIndex: i, colIndex: j };
            }
        }
    }
    return null;
}

/**
 * Достаёт значение показателя по его названию.
 * Берёт ячейку справа от label (colIndex + 1).
 * Если её нет — возвращает '—'.
 */
function getIndicator_(data, label) {
    const found = findIndicator_(data, label);
    if (!found) return '—';
    const row = data[found.rowIndex] || [];
    const value = row[found.colIndex + 1];
    return value == null || value === '' ? '—' : value;
}

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadData() {
    try {
        const result = await fetchJson_(API_URL);

        if (!result.success) {
            throw new Error(result.error || 'Ошибка сервера');
        }

        const d = result.data || [];
        console.log('✅ Данные получены, строк:', d.length);

        // ============================================================
        // Вывод данных — берем значения из колонки C (индекс 2)
        // ============================================================
        
        // 1. Ищем метку и берем значение из соседней колонки
        const budgetTotal = getIndicator_(d, 'Итого наш бюджет:'); // Строка 10, колонка C
        const inCash      = getIndicator_(d, 'В наличии:');         // Строка 16, колонка C
        const withdrawn   = getIndicator_(d, 'Снято:');             // Строка 15, колонка C
        const monthlyRet  = getIndicator_(d, 'Месячный возврат:');  // Строка 17, колонка C

          // 2. Особый случай: ищем текст в колонке B, а число берем из колонки C
        let monthsLeft = '—';
        for (let i = 0; i < d.length; i++) {
            const cellText = String(d[i][1] || ''); // Колонка B (индекс 1)
            
            // Если нашли текст про месяцы
            if (cellText.includes('До июня осталось месяцев:')) {
                // Берем число из соседней ячейки справа (Колонка C, индекс 2)
                const val = d[i][2]; 
                if (val !== '' && val != null) {
                    monthsLeft = val;
                }
                break;
            }
        }

        // ============================================================
        // Рендер
        // ============================================================
        document.querySelector('.budget').innerHTML = `
            <div>💰 ${fmt_(budgetTotal)} $</div>
            <div>✅ ${fmt_(inCash)} $</div>
            <div>📉 ${fmt_(withdrawn)} $</div>
            <div>📅 ${monthsLeft} мес.</div>
            <div>💵 ${fmt_(monthlyRet)} $</div>
        `;

    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        document.querySelector('.budget').textContent = 'Ошибка: ' + error.message;
    }
}

// ============================================================
// БЛОКИРОВКА / РАЗБЛОКИРОВКА КНОПОК
// ============================================================

function lockButtons() {
    isProcessing = true;

    const incomeBtn = document.getElementById('incomeBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');

    if (incomeBtn) incomeBtn.disabled = true;
    if (withdrawBtn) withdrawBtn.disabled = true;

    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '⏳ Отправка...';
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.disabled = true;
}

function unlockButtons() {
    isProcessing = false;

    const incomeBtn = document.getElementById('incomeBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');

    if (incomeBtn) incomeBtn.disabled = false;
    if (withdrawBtn) withdrawBtn.disabled = false;

    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Подтвердить';
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.disabled = false;
}

// ============================================================
// ДОБАВЛЕНИЕ ТРАНЗАКЦИИ (через GET-запрос)
// ============================================================

async function addTransaction(amount, type) {
    const signedAmount = type === 'withdraw' ? -Math.abs(amount) : Math.abs(amount);

    try {
        const url = API_URL + '?action=addTransaction&amount=' + encodeURIComponent(signedAmount);
        console.log('📤 Отправка:', url);

        const result = await fetchJson_(url, {
            method: 'GET',
            mode: 'cors',
        });

        console.log('📥 Ответ:', result);

        if (!result.success) {
            throw new Error(result.error || 'Ошибка сервера');
        }

        console.log('✅ Транзакция добавлена:', result);

        // Небольшая пауза, чтобы Google успел пересчитать формулы
        await new Promise(resolve => setTimeout(resolve, 1200));
        await loadData();

        return true;

    } catch (error) {
        console.error('❌ Ошибка добавления:', error);
        alert('Не удалось добавить транзакцию: ' + error.message);
        return false;
    }
}

// ============================================================
// МОДАЛЬНОЕ ОКНО
// ============================================================

function openModal(action) {
    if (isProcessing) return;

    currentAction = action;
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const input = document.getElementById('amountInput');

    title.textContent = action === 'income' ? '➕ Пополнить' : '➖ Снять';
    input.value = '';
    modal.classList.remove('hidden');
    input.focus();
}

function closeModal() {
    if (isProcessing) return;

    document.getElementById('modal').classList.add('hidden');
    currentAction = null;
}

async function confirmModal() {
    if (isProcessing) return;

    const input = document.getElementById('amountInput');
    const amount = parseFloat(input.value);

    if (!isFinite(amount) || amount <= 0) {
        alert('Введите сумму больше 0');
        return;
    }

    lockButtons();

    const success = await addTransaction(amount, currentAction);

    unlockButtons();

    if (success) {
        closeModal();
    }
}

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    const incomeBtn = document.getElementById('incomeBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');

    if (incomeBtn) incomeBtn.addEventListener('click', () => openModal('income'));
    if (withdrawBtn) withdrawBtn.addEventListener('click', () => openModal('withdraw'));

    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const amountInput = document.getElementById('amountInput');
    const modal = document.getElementById('modal');

    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmModal);

    if (amountInput) {
        amountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmModal();
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'modal') closeModal();
        });
    }
});
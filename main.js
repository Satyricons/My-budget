// ============================================================
// URL веб-приложения
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwUoXK-_rZUH0GYE81emVghdoxmM_Ufz9b2fb3jIg5nS9oHT2xK7OdOevDP25onHq1JnQ/exec';

// ============================================================
// Текущее действие: 'income' или 'withdraw'
// ============================================================
let currentAction = null;
let isProcessing = false;

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadData() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Ошибка сервера');
        }

        console.log('✅ Данные:', result.data);

        const d = result.data;

        // ============================================================
        // Ищем строку с заголовком "Транзакции" во ВСЕХ колонках
        // ============================================================
        let headerRow = -1;
        for (let i = 0; i < d.length; i++) {
            for (let j = 0; j < d[i].length; j++) {
                if (String(d[i][j] || '').trim() === 'Транзакции') {
                    headerRow = i;
                    break;
                }
            }
            if (headerRow !== -1) break;
        }

        console.log('📍 Строка с заголовком "Транзакции":', headerRow);

        // ============================================================
        // Ищем последнюю транзакцию (максимальный ID)
        // Долг берём из колонки D (индекс 3)
        // ============================================================
        let lastDebt = 0;
        let lastTransaction = null;

        if (headerRow !== -1) {
            for (let i = headerRow + 1; i < d.length; i++) {
                const id = parseInt(d[i][0]);
                if (!isNaN(id) && id > 0) {
                    lastTransaction = d[i];
                    const debtValue = parseFloat(d[i][3]);
                    if (!isNaN(debtValue)) {
                        lastDebt = debtValue;
                    }
                }
            }
        }

        console.log('📊 Последний долг:', lastDebt);
        console.log('📋 Последняя транзакция:', lastTransaction);

        // ============================================================
        // Вывод данных
        // ============================================================
        document.querySelector('.budget').innerHTML = `
            <div>💰 ${d[9][1]}  ${d[9][2]} $</div>
            <div>✅ ${d[15][1]} ${d[15][2]} $</div>
            <div>📉 ${d[14][1]} ${d[14][2]} $</div>
            <div>📅 ${d[3][1]}  ${d[3][2]}</div>
            <div>💵 ${d[16][1]} ${d[16][2]} $</div>            
        `;

    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        document.querySelector('.budget').textContent = 'Ошибка: ' + error.message;
    }
}

// ============================================================
// БЛОКИРОВКА / РАЗБЛОКИРОВКА КНОПОК
// ============================================================

function lockButtons(activeBtnId) {
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

        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
        });

        const result = await response.json();
        console.log('📥 Ответ:', result);

        if (!result.success) {
            throw new Error(result.error || 'Ошибка сервера');
        }

        console.log('✅ Транзакция добавлена:', result);

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

    if (!amount || amount <= 0) {
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
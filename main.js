// ============================================================
// ИМПОРТЫ
// ============================================================
import { fetchBudgetData, addTransaction, fmt } from './api.js';

// ============================================================
// СОСТОЯНИЕ ИНТЕРФЕЙСА
// ============================================================
let currentAction = null;
let isProcessing = false;

// ============================================================
// РАБОТА С DOM
// ============================================================

async function updateUI() {
    const budgetEl = document.querySelector('.budget');
    const ratesEl = document.querySelector('.exchange-rates'); // Элемент в шапке
    
    // Показываем состояние загрузки только при первой загрузке
    if (!budgetEl.dataset.loaded) {
        budgetEl.textContent = 'Загрузка...';
    }

    try {
        const data = await fetchBudgetData();
        
        // Обновляем блок с бюджетом
        budgetEl.innerHTML = `
            <div>💰 ${fmt(data.budgetTotal)} $</div>
            <div>✅ ${fmt(data.inCash)} $</div>
            <div>📉 ${fmt(data.withdrawn)} $</div>
            <div>📅 ${data.monthsLeft} мес.</div>
            <div>💵 ${fmt(data.monthlyRet)} $</div>
        `;
        
        // Обновляем шапку с курсами
        if (ratesEl) {
            console.log('🔍 Отладка курсов:', data.rateUSD, data.rateBYN);
            // Безопасный парсинг чисел из таблицы (заменяем запятую на точку, убираем мусор)
            const parseRate = (val) => {
                if (val === null || val === undefined || val === '') return NaN;
                const cleanStr = String(val).replace(',', '.').replace(/[^\d.-]/g, '');
                return parseFloat(cleanStr);
            };

            const usdNum = parseRate(data.rateUSD);
            const bynNum = parseRate(data.rateBYN);

            // Если числа валидные, форматируем их, иначе выводим прочерк
            const usd = !isNaN(usdNum) ? usdNum.toLocaleString('ru-RU', { maximumFractionDigits: 3 }) : '—';
            const byn = !isNaN(bynNum) ? bynNum.toLocaleString('ru-RU', { maximumFractionDigits: 3 }) : '—';
            
            ratesEl.textContent = `Курс: $ ${usd} | BYN ${byn}`;
        }
        
        budgetEl.dataset.loaded = 'true'; // Запоминаем, что загрузка прошла успешно
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        budgetEl.textContent = 'Ошибка: ' + error.message;
    }
}

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

async function handleConfirm() {
    if (isProcessing) return;

    const input = document.getElementById('amountInput');
    const amount = parseFloat(input.value);

    if (!isFinite(amount) || amount <= 0) {
        alert('Введите сумму больше 0');
        return;
    }

    lockButtons();

    try {
        await addTransaction(amount, currentAction);
        
        // Небольшая пауза, чтобы Google успел пересчитать формулы
        await new Promise(resolve => setTimeout(resolve, 1200));
        await updateUI();
        
        closeModal();
    } catch (error) {
        console.error('❌ Ошибка добавления:', error);
        alert('Не удалось добавить транзакцию: ' + error.message);
    } finally {
        unlockButtons();
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    updateUI();

    const incomeBtn = document.getElementById('incomeBtn');
    const withdrawBtn = document.getElementById('withdrawBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const amountInput = document.getElementById('amountInput');
    const modal = document.getElementById('modal');

    if (incomeBtn) incomeBtn.addEventListener('click', () => openModal('income'));
    if (withdrawBtn) withdrawBtn.addEventListener('click', () => openModal('withdraw'));
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);

    if (amountInput) {
        amountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleConfirm();
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'modal') closeModal();
        });
    }
});
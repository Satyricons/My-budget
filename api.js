// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzUm-PXBXoSORZEc2Vy4GIdTe7Jt1bHL3lVbRjmZy6IFQ9O76FhR7Ry6381o3GwPqBtEA/exec';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

export async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Сервер вернул не JSON. Ответ: ${text.slice(0, 200)}`);
    }
    return response.json();
}

export function fmt(value) {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function findIndicator(data, label) {
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

export function getIndicator(data, label) {
    const found = findIndicator(data, label);
    if (!found) return '—';
    const row = data[found.rowIndex] || [];
    const value = row[found.colIndex + 1];
    return value == null || value === '' ? '—' : value;
}

// ============================================================
// ОСНОВНЫЕ ФУНКЦИИ API
// ============================================================

export async function fetchBudgetData() {
    const result = await fetchJson(API_URL);
    if (!result.success) throw new Error(result.error || 'Ошибка сервера');

    const d = result.data || [];
    
    // 1. Ищем месяцы
    let monthsLeft = '—';
    for (let i = 0; i < d.length; i++) {
        const cellText = String(d[i][1] || '');
        if (cellText.includes('До июня осталось месяцев:')) {
            if (d[i][2] != null && d[i][2] !== '') monthsLeft = d[i][2];
            break;
        }
    }

    // 2. Ищем курсы валют
    let rateUSD = '—';
    let rateBYN = '—';
    
    for (let i = 0; i < d.length; i++) {
        const row = d[i] || [];
        
        // Ищем во всей строке ячейку, где есть слово "Курс"
        const colIndex = row.findIndex(cell => String(cell || '').toLowerCase().includes('курс'));
        
        // Если нашли такую ячейку
        if (colIndex !== -1) {
            // Берем числа из соседних ячеек (на 1 и на 2 правее)
            if (row[colIndex + 1] != null && row[colIndex + 1] !== '') rateUSD = row[colIndex + 1];
            if (row[colIndex + 2] != null && row[colIndex + 2] !== '') rateBYN = row[colIndex + 2];
            break; // Нашли нужную строку, выходим из цикла
        }
    }

    return {
        budgetTotal: getIndicator(d, 'Итого наш бюджет:'),
        inCash: getIndicator(d, 'В наличии:'),
        withdrawn: getIndicator(d, 'Снято:'),
        monthlyRet: getIndicator(d, 'Месячный возврат:'),
        monthsLeft: monthsLeft,
        rateUSD: rateUSD,
        rateBYN: rateBYN
    };
}

export async function addTransaction(amount, type) {
    const signedAmount = type === 'withdraw' ? -Math.abs(amount) : Math.abs(amount);
    const url = API_URL + '?action=addTransaction&amount=' + encodeURIComponent(signedAmount);

    const result = await fetchJson(url, { method: 'GET', mode: 'cors' });
    if (!result.success) throw new Error(result.error || 'Ошибка сервера');
    return result;
}
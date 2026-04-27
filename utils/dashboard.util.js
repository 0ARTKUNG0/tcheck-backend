/**
 * Dashboard Helper Utilities
 * รวมฟังก์ชันคำนวณสถิติสำหรับ Admin (และ User Dashboard ในอนาคต)
 */

/**
 * คืนค่าเวลา 00:00:00 ของวันนี้ (Bangkok time)
 */
function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * คืนค่าเวลา N วันที่แล้ว (เริ่มต้นวัน)
 */
function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Format วันที่เป็น YYYY-MM-DD สำหรับ chart labels
 */
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

/**
 * สร้าง array ของวันที่ย้อนหลัง N วัน (สำหรับ chart)
 * เช่น [{date: "2026-04-01", count: 0}, ...]
 */
function buildDateRange(days) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = daysAgo(i);
        result.push({ date: formatDate(d), value: 0 });
    }
    return result;
}

/**
 * แปลง MongoDB aggregation result (group by date) เป็น chart data ที่เติมวันที่ขาดให้ครบ
 * @param {Array} aggregateResult - [{_id: "2026-04-01", count: 5}, ...]
 * @param {number} days - จำนวนวันย้อนหลัง
 * @returns {Array} [{date, value}]
 */
function fillDateGaps(aggregateResult, days) {
    const dateRange = buildDateRange(days);
    const dataMap = new Map(aggregateResult.map(item => [item._id, item.count]));
    return dateRange.map(item => ({
        date: item.date,
        value: dataMap.get(item.date) || 0
    }));
}

module.exports = {
    startOfToday,
    daysAgo,
    formatDate,
    buildDateRange,
    fillDateGaps
};

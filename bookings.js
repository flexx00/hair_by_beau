// bookings.js - Minimal & Fixed Version
let allBookings = [];

// Load bookings from localStorage
function loadBookings() {
    const cached = localStorage.getItem("hb_bookings");
    allBookings = cached ? JSON.parse(cached) : [];
    return allBookings;
}

// Save bookings to localStorage
function saveBookings() {
    localStorage.setItem("hb_bookings", JSON.stringify(allBookings));
}

// Add a new booking
function addBooking(booking) {
    if (!booking.id) booking.id = Date.now();
    if (!booking.status) booking.status = "active";
    allBookings.push(booking);
    saveBookings();
    return booking;
}

// Delete a booking by ID
function deleteBooking(bookingId) {
    if (!confirm("Delete this booking permanently?")) return;
    allBookings = allBookings.filter(b => b.id !== bookingId);
    saveBookings();
}

// Cancel a booking by ID
function cancelBooking(bookingId) {
    if (!confirm("Cancel this booking?")) return;
    const booking = allBookings.find(b => b.id === bookingId);
    if (booking) {
        booking.status = "cancelled";
        saveBookings();
    }
}

// Get all bookings (returns a copy)
function getAllBookings() {
    return [...allBookings];
}

// Export bookings as a JS file
function exportBookingsAsJS() {
    const date = new Date().toLocaleString();
    const data = JSON.stringify(allBookings, null, 4);
    const content = `// bookings.js - Exported on ${date}\n\nlet allBookings = ${data};\n\n` +
        `function loadBookings() { return allBookings; }\n` +
        `function saveBookings() { console.log("Saved"); }\n` +
        `function addBooking(b) { allBookings.push(b); saveBookings(); }\n` +
        `function deleteBooking(id) { allBookings = allBookings.filter(b => b.id !== id); saveBookings(); }\n` +
        `function cancelBooking(id) { const b = allBookings.find(x => x.id === id); if(b) b.status = "cancelled"; saveBookings(); }\n` +
        `function getAllBookings() { return [...allBookings]; }\n\n` +
        `window.loadBookings = loadBookings;\nwindow.saveBookings = saveBookings;\n` +
        `window.addBooking = addBooking;\nwindow.deleteBooking = deleteBooking;\n` +
        `window.cancelBooking = cancelBooking;\nwindow.getAllBookings = getAllBookings;\n`;

    const blob = new Blob([content], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.js";
    a.click();
    URL.revokeObjectURL(url);
}

// Make all functions available globally
window.loadBookings = loadBookings;
window.saveBookings = saveBookings;
window.addBooking = addBooking;
window.deleteBooking = deleteBooking;
window.cancelBooking = cancelBooking;
window.getAllBookings = getAllBookings;
window.exportBookingsAsJS = exportBookingsAsJS;

// Initialize bookings on script load
loadBookings();
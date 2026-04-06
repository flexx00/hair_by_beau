// bookings.js - Hair By Beau Bookings System (Fixed & Improved)

let allBookings = [];

// Load bookings from localStorage
function loadBookings() {
    const cached = localStorage.getItem("hb_bookings");
    allBookings = cached ? JSON.parse(cached) : [];
    return allBookings;
}

// Save bookings
function saveBookings() {
    localStorage.setItem("hb_bookings", JSON.stringify(allBookings));
}

// Add new booking
function addBooking(booking) {
    if (!booking.id) booking.id = Date.now();
    if (!booking.status) booking.status = "active";
    allBookings.push(booking);
    saveBookings();
    return booking;
}

// Delete booking permanently
function deleteBooking(bookingId) {
    allBookings = allBookings.filter(b => b.id !== bookingId);
    saveBookings();
}

// Cancel booking
function cancelBooking(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (booking) {
        booking.status = "cancelled";
        saveBookings();
    }
}

// Get all bookings
function getAllBookings() {
    return [...allBookings];
}

// Export as bookings.js file
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

// Make functions global
window.loadBookings = loadBookings;
window.saveBookings = saveBookings;
window.addBooking = addBooking;
window.deleteBooking = deleteBooking;
window.cancelBooking = cancelBooking;
window.getAllBookings = getAllBookings;
window.exportBookingsAsJS = exportBookingsAsJS;
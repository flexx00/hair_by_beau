// bookings.js
const allBookings = JSON.parse(localStorage.getItem("hb_bookings")) || [];

// Save bookings to localStorage
function saveBookings() {
    localStorage.setItem("hb_bookings", JSON.stringify(allBookings));
}

// Fetch bookings from the server
async function fetchBookings() {
    try {
        const response = await fetch("https://hair-by-beau.onrender.com/bookings");
        if (response.ok) {
            const serverBookings = await response.json();
            allBookings.length = 0; // Clear the current array
            Array.prototype.push.apply(allBookings, serverBookings); // Add server bookings
            saveBookings(); // Save to localStorage
        }
    } catch (error) {
        console.error("Failed to fetch bookings from server:", error);
    }
}

// Add a new booking
async function addBooking(booking) {
    if (!booking.id) booking.id = Date.now();
    if (!booking.status) booking.status = "active";
    allBookings.push(booking);
    saveBookings();

    try {
        const response = await fetch("https://hair-by-beau.onrender.com/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(booking),
        });
        if (!response.ok) {
            console.error("Failed to save booking to server");
        }
    } catch (error) {
        console.error("Error saving booking to server:", error);
    }
    return booking;
}

// Delete a booking by ID
async function deleteBooking(bookingId) {
    if (!confirm("Delete this booking permanently?")) return;
    const index = allBookings.findIndex((b) => b.id === bookingId);
    if (index !== -1) {
        allBookings.splice(index, 1);
        saveBookings();

        try {
            const response = await fetch(`https://hair-by-beau.onrender.com/bookings/${bookingId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                console.error("Failed to delete booking from server");
            }
        } catch (error) {
            console.error("Error deleting booking from server:", error);
        }
    }
}

// Cancel a booking by ID
async function cancelBooking(bookingId) {
    if (!confirm("Cancel this booking?")) return;
    const booking = allBookings.find((b) => b.id === bookingId);
    if (booking) {
        booking.status = "cancelled";
        saveBookings();

        try {
            const response = await fetch(`https://hair-by-beau.onrender.com/bookings/${bookingId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: "cancelled" }),
            });
            if (!response.ok) {
                console.error("Failed to update booking status on server");
            }
        } catch (error) {
            console.error("Error updating booking status on server:", error);
        }
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
    const content =
        `// bookings.js - Exported on ${date}\n\nconst allBookings = ${data};\n\n` +
        `function saveBookings() { localStorage.setItem("hb_bookings", JSON.stringify(allBookings)); }\n` +
        `function addBooking(b) { if (!b.id) b.id = Date.now(); if (!b.status) b.status = "active"; allBookings.push(b); saveBookings(); }\n` +
        `function deleteBooking(id) { const index = allBookings.findIndex(b => b.id === id); if (index !== -1) allBookings.splice(index, 1); saveBookings(); }\n` +
        `function cancelBooking(id) { const b = allBookings.find(b => b.id === id); if (b) b.status = "cancelled"; saveBookings(); }\n` +
        `function getAllBookings() { return [...allBookings]; }\n\n` +
        `window.saveBookings = saveBookings;\nwindow.addBooking = addBooking;\n` +
        `window.deleteBooking = deleteBooking;\nwindow.cancelBooking = cancelBooking;\n` +
        `window.getAllBookings = getAllBookings;\n`;

    const blob = new Blob([content], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.js";
    a.click();
    URL.revokeObjectURL(url);
}

// Initialize bookings on script load
fetchBookings();

// Make all functions available globally
window.saveBookings = saveBookings;
window.addBooking = addBooking;
window.deleteBooking = deleteBooking;
window.cancelBooking = cancelBooking;
window.getAllBookings = getAllBookings;
window.exportBookingsAsJS = exportBookingsAsJS;
window.fetchBookings = fetchBookings;
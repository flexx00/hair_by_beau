<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't show errors to users
ini_set('log_errors', 1);

// Include Twilio PHP library
require_once 'twilio-php-main/src/Twilio/autoload.php'; // Adjust path as needed

use Twilio\Rest\Client;

// Your Twilio credentials (MUST be updated)
$twilioSid = 'AC4598af68d81c78de170b6529d318eda7';     // Get from Twilio Console
$twilioAuthToken = 'ccbd704f5f73817e7f876370763020f0'; // Get from Twilio Console
$twilioPhoneNumber = '+447460963690';          // Your Twilio phone number

// ========== DO NOT EDIT BELOW THIS LINE ==========
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Get booking data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Validate
if (!$data || empty($data['phone'])) {
    echo json_encode(['success' => false, 'error' => 'Missing phone number']);
    exit;
}

// Format phone number (E.164 format)
$phone = $data['phone'];
$phone = preg_replace('/[^0-9+]/', '', $phone);
if (substr($phone, 0, 1) != '+') {
    $phone = '+' . $phone;
}

// Create message
$message = "✅ APPOINTMENT CONFIRMED!\n\n";
$message .= "Name: " . ($data['name'] ?? 'Customer') . "\n";
$message .= "Date: " . ($data['date'] ?? 'N/A') . "\n";
$message .= "Time: " . ($data['time'] ?? 'N/A') . "\n";
$message .= "Service: " . ($data['service'] ?? 'N/A') . "\n\n";
$message .= "Thank you for choosing us! 🎉";

// Send via Twilio API
$url = "https://api.twilio.com/2010-04-01/Accounts/{$twilioSid}/Messages.json";
$postData = http_build_query([
    'To' => $phone,
    'From' => $twilioPhoneNumber,
    'Body' => $message
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERPWD, "{$twilioSid}:{$twilioAuthToken}");
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Return result
if ($httpCode == 201) {
    echo json_encode(['success' => true, 'message' => 'SMS sent successfully']);
} else {
    echo json_encode(['success' => false, 'error' => 'Twilio error: ' . $response]);
}
?>
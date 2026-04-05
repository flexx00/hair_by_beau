<?php
// ========== UPDATE THESE WITH YOUR TWILIO CREDENTIALS ==========
$twilioSid = 'AC4598af68d81c78de170b6529d318eda7';     // Get from Twilio Console
$twilioAuthToken = 'ccbd704f5f73817e7f876370763020f0'; // Get from Twilio Console
$twilioPhoneNumber = '+447460963690';          // Your Twilio phone number
$yourPersonalPhone = '+447932355630';                    // YOUR phone number

// ========== TEST SCRIPT ==========
echo "<h1>Twilio SMS Test</h1>";

// Check if cURL is installed
if (!extension_loaded('curl')) {
    die("❌ cURL is NOT installed on your server. Contact your hosting provider.");
}
echo "✅ cURL is installed<br>";

// Send test message
$message = "Test message from your website! It works! 🎉";

$url = "https://api.twilio.com/2010-04-01/Accounts/{$twilioSid}/Messages.json";
$postData = http_build_query([
    'To' => $yourPersonalPhone,
    'From' => $twilioPhoneNumber,
    'Body' => $message
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERPWD, "{$twilioSid}:{$twilioAuthToken}");
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

echo "<br>HTTP Status Code: <strong>$httpCode</strong><br>";

if ($httpCode == 201) {
    echo "<h2 style='color:green'>✅ SUCCESS! SMS sent to your phone!</h2>";
    echo "Check your phone for a text message.<br>";
    $result = json_decode($response, true);
    echo "Message SID: " . $result['sid'] . "<br>";
} else {
    echo "<h2 style='color:red'>❌ FAILED to send SMS</h2>";
    echo "Error: " . $error . "<br>";
    echo "Response: " . $response . "<br><br>";
    
    echo "<h3>Troubleshooting:</h3>";
    echo "<ul>";
    echo "<li>Double-check your Account SID and Auth Token</li>";
    echo "<li>Verify your Twilio phone number is active</li>";
    echo "<li>If on trial, your phone number must be verified in Twilio</li>";
    echo "<li>Check if you have credits: Console → Billing</li>";
    echo "</ul>";
}
?>
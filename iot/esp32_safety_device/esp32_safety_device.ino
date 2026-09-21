#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Make sure to include http:// and port
const String API_BASE_URL = "http://10.123.18.7:8000"; 
const String DEVICE_ID = "ESP32-001";

// --- Hardware Pins ---
const int SOS_BUTTON_PIN = 4;
const int BUZZER_PIN = 5;

// --- State Variables ---
unsigned long lastLocationUpdate = 0;
const unsigned long LOCATION_UPDATE_INTERVAL = 30000; // 30 seconds
bool isBuzzerActive = false;

// --- Simulation Coordinates (Since no real GPS hardware is assumed) ---
float currentLat = 16.502;
float currentLon = 80.642;

void setup() {
  Serial.begin(115200);
  
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Connect to Wi-Fi
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // 1. Check SOS Button
  if (digitalRead(SOS_BUTTON_PIN) == LOW) {
    Serial.println("SOS Button Pressed!");
    triggerSOS();
    // Debounce delay
    delay(2000); 
  }
  
  // 2. Periodic Location Update
  if (millis() - lastLocationUpdate > LOCATION_UPDATE_INTERVAL) {
    lastLocationUpdate = millis();
    sendLocationUpdate();
  }
  
  // 3. Handle Buzzer
  if (isBuzzerActive) {
    // Simple beep pattern
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
  
  // Optional: Read Serial for manual coordinate simulation
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    if (input.startsWith("LAT:")) {
      currentLat = input.substring(4).toFloat();
      Serial.print("New Lat: "); Serial.println(currentLat);
    } else if (input.startsWith("LON:")) {
      currentLon = input.substring(4).toFloat();
      Serial.print("New Lon: "); Serial.println(currentLon);
    }
  }
}

void triggerSOS() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = API_BASE_URL + "/api/iot/sos";
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["device_id"] = DEVICE_ID;
    doc["latitude"] = currentLat;
    doc["longitude"] = currentLon;
    
    String requestBody;
    serializeJson(doc, requestBody);
    
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode > 0) {
      Serial.print("SOS HTTP Response code: ");
      Serial.println(httpResponseCode);
      // Activate buzzer to confirm SOS sent
      isBuzzerActive = true; 
    } else {
      Serial.print("Error sending SOS: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  }
}

void sendLocationUpdate() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = API_BASE_URL + "/api/iot/location";
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["device_id"] = DEVICE_ID;
    doc["latitude"] = currentLat;
    doc["longitude"] = currentLon;
    
    String requestBody;
    serializeJson(doc, requestBody);
    
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Location Update Sent. Response:");
      Serial.println(response);
      
      // Check if we are in a risk zone based on response
      StaticJsonDocument<512> responseDoc;
      deserializeJson(responseDoc, response);
      
      bool inRiskZone = responseDoc["risk_zone"];
      if (inRiskZone) {
        Serial.println("WARNING: Entered Potential Risk Zone!");
        isBuzzerActive = true;
      } else {
        isBuzzerActive = false;
      }
      
    } else {
      Serial.print("Error sending location: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  }
}

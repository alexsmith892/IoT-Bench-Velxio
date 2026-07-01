// WRONG (light_alarm_hysteresis): inverts the alarm sense — turns the LED on when
// the reading is HIGH (bright) and off when LOW (dark). Fails the pin-state
// contract wherever a low reading must drive the LED on. expectFailCategory:
// pin-state.

const int SENSOR_PIN = A2;
const int LED_PIN = 6;

bool alarmOn = false;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  int reading = analogRead(SENSOR_PIN);
  if (reading >= 450) {
    alarmOn = true; // inverted: on when bright
  } else if (reading <= 350) {
    alarmOn = false;
  }
  digitalWrite(LED_PIN, alarmOn ? HIGH : LOW);
  delay(20);
}

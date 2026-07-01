// WRONG (light_alarm_hysteresis): uses ONE threshold at 400 with no hysteresis
// band. It turns the LED on for any reading < 400 and off otherwise, so inside the
// 350..450 band it flips instead of holding the previous state. Fails the pin-state
// contract on the hysteresis-hold variant. expectFailCategory: pin-state.

const int SENSOR_PIN = A2;
const int LED_PIN = 6;
const int THRESHOLD = 400;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  int reading = analogRead(SENSOR_PIN);
  digitalWrite(LED_PIN, reading < THRESHOLD ? HIGH : LOW); // no hold band
  delay(20);
}

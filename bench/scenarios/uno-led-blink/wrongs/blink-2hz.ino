// Adversarial wrong: blinks at 2 Hz instead of 1 Hz.
// Designed to FAIL the frequency contract (intended-failure category).

constexpr int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(250);
  digitalWrite(LED_PIN, LOW);
  delay(250);
}

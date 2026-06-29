// Benchmark inspection smoke fixture: external LED on Arduino Uno pin 13.
// The circuit routes pin 13 through a 220-ohm resistor and LED to ground.

constexpr int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}

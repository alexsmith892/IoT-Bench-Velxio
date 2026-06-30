// dual_input_safety_enable (OS-D1-02) — reference solution.
// Two normally-open switches to ground on D4/D5 (INPUT_PULLUP → closed = LOW).
// Active-high ENABLE on D8 is HIGH only while BOTH switches are closed.

const int SW1_PIN = 4;
const int SW2_PIN = 5;
const int ENABLE_PIN = 8;

void setup() {
  pinMode(SW1_PIN, INPUT_PULLUP);
  pinMode(SW2_PIN, INPUT_PULLUP);
  pinMode(ENABLE_PIN, OUTPUT);
  digitalWrite(ENABLE_PIN, LOW);
}

void loop() {
  bool both = digitalRead(SW1_PIN) == LOW && digitalRead(SW2_PIN) == LOW;
  digitalWrite(ENABLE_PIN, both ? HIGH : LOW);
}

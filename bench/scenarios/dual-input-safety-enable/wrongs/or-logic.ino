// WRONG (dual_input_safety_enable): enables on EITHER switch closed (OR) instead
// of BOTH (AND). Passes the both-closed and both-open cases but drives ENABLE
// HIGH when only one switch is closed. expectFailCategory: pin-state.

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
  bool either = digitalRead(SW1_PIN) == LOW || digitalRead(SW2_PIN) == LOW;
  digitalWrite(ENABLE_PIN, either ? HIGH : LOW); // wrong: OR
}

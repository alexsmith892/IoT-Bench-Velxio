// WRONG (dual_input_safety_enable): hardcoded — ENABLE permanently HIGH,
// ignoring the interlock. Fails every case where the switches are not both
// closed (including startup). expectFailCategory: pin-state.

const int ENABLE_PIN = 8;

void setup() {
  pinMode(ENABLE_PIN, OUTPUT);
  digitalWrite(ENABLE_PIN, HIGH); // wrong: enabled regardless of inputs
}

void loop() {
  digitalWrite(ENABLE_PIN, HIGH);
}

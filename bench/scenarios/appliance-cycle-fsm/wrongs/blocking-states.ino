// WRONG (appliance_cycle_fsm): runs each stage with a blocking delay(), so it cannot
// react to a door-open (or cancel press) during a stage. The abort never happens
// within 20 ms — the motor keeps running to the end of its delay. Fails the pin-state
// contract on the door-abort variant. expectFailCategory: pin-state.

const int DOOR_PIN = 2;
const int BTN_PIN = 3;
const int FILL_PIN = 6;
const int MOTOR_PIN = 7;
const int DRAIN_PIN = 8;
const unsigned long DEBOUNCE_MS = 30;

int bStable = HIGH, bLast = HIGH; unsigned long bChange = 0;

bool buttonPressed() {
  int r = digitalRead(BTN_PIN);
  if (r != bLast) { bLast = r; bChange = millis(); }
  if (millis() - bChange >= DEBOUNCE_MS && r != bStable) {
    bStable = r;
    if (bStable == LOW) return true;
  }
  return false;
}

bool doorClosed() { return digitalRead(DOOR_PIN) == LOW; }

void allOff() {
  digitalWrite(FILL_PIN, LOW);
  digitalWrite(MOTOR_PIN, LOW);
  digitalWrite(DRAIN_PIN, LOW);
}

void setup() {
  pinMode(DOOR_PIN, INPUT_PULLUP);
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(FILL_PIN, OUTPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(DRAIN_PIN, OUTPUT);
  allOff();
  Serial.begin(115200);
}

void loop() {
  if (buttonPressed()) {
    if (!doorClosed()) { Serial.println("STATE=DOOR_OPEN"); return; }
    digitalWrite(FILL_PIN, HIGH); Serial.println("STATE=FILL"); delay(300); digitalWrite(FILL_PIN, LOW);
    digitalWrite(MOTOR_PIN, HIGH); Serial.println("STATE=WASH"); delay(600); digitalWrite(MOTOR_PIN, LOW);
    digitalWrite(DRAIN_PIN, HIGH); Serial.println("STATE=DRAIN"); delay(300); digitalWrite(DRAIN_PIN, LOW);
    Serial.println("STATE=DONE"); // BUG: never checks door/cancel during the stages
  }
}

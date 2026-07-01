// WRONG (appliance_cycle_fsm): starts the cycle on a button press regardless of the
// door. With the door open it drives FILL and prints STATE=FILL instead of leaving
// the outputs low and printing STATE=DOOR_OPEN. Fails on the door-open-start variant.
// expectFailCategory: serial-format.

const int DOOR_PIN = 2;
const int BTN_PIN = 3;
const int FILL_PIN = 6;
const int MOTOR_PIN = 7;
const int DRAIN_PIN = 8;
const unsigned long DEBOUNCE_MS = 30;

enum State { IDLE, S_FILL, S_WASH, S_DRAIN };
State state = IDLE;
unsigned long stateStart = 0;

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
  bool press = buttonPressed();
  unsigned long now = millis();

  if (state != IDLE && (!doorClosed() || press)) {
    allOff();
    Serial.println("STATE=ABORT");
    state = IDLE;
    return;
  }

  switch (state) {
    case IDLE:
      if (press) { // BUG: no door check — starts regardless
        allOff();
        digitalWrite(FILL_PIN, HIGH);
        Serial.println("STATE=FILL");
        state = S_FILL; stateStart = now;
      }
      break;
    case S_FILL:
      if (now - stateStart >= 300) { digitalWrite(FILL_PIN, LOW); digitalWrite(MOTOR_PIN, HIGH); Serial.println("STATE=WASH"); state = S_WASH; stateStart = now; }
      break;
    case S_WASH:
      if (now - stateStart >= 600) { digitalWrite(MOTOR_PIN, LOW); digitalWrite(DRAIN_PIN, HIGH); Serial.println("STATE=DRAIN"); state = S_DRAIN; stateStart = now; }
      break;
    case S_DRAIN:
      if (now - stateStart >= 300) { digitalWrite(DRAIN_PIN, LOW); Serial.println("STATE=DONE"); state = IDLE; }
      break;
  }
}

// appliance_cycle_fsm (OS-D3-04) — reference solution.
// Door switch D2 (closed = LOW, INPUT_PULLUP). START/CANCEL button D3 (INPUT_PULLUP,
// 30 ms debounce). Active-high outputs FILL D6, MOTOR D7, DRAIN D8. Serial @115200.
// IDLE (all LOW): a debounced press starts a cycle only if the door is closed;
// otherwise print STATE=DOOR_OPEN. Cycle, no overlap: FILL 300 ms (STATE=FILL),
// MOTOR 600 ms (STATE=WASH), DRAIN 300 ms (STATE=DRAIN), then all LOW + STATE=DONE.
// If the door opens OR the button is pressed during a cycle: abort within 20 ms —
// all LOW, STATE=ABORT, back to IDLE.

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

  // Abort: door opened or a button press during any active stage (within one loop).
  if (state != IDLE && (!doorClosed() || press)) {
    allOff();
    Serial.println("STATE=ABORT");
    state = IDLE;
    return;
  }

  switch (state) {
    case IDLE:
      if (press) {
        if (doorClosed()) {
          allOff();
          digitalWrite(FILL_PIN, HIGH);
          Serial.println("STATE=FILL");
          state = S_FILL; stateStart = now;
        } else {
          Serial.println("STATE=DOOR_OPEN");
        }
      }
      break;
    case S_FILL:
      if (now - stateStart >= 300) {
        digitalWrite(FILL_PIN, LOW);
        digitalWrite(MOTOR_PIN, HIGH);
        Serial.println("STATE=WASH");
        state = S_WASH; stateStart = now;
      }
      break;
    case S_WASH:
      if (now - stateStart >= 600) {
        digitalWrite(MOTOR_PIN, LOW);
        digitalWrite(DRAIN_PIN, HIGH);
        Serial.println("STATE=DRAIN");
        state = S_DRAIN; stateStart = now;
      }
      break;
    case S_DRAIN:
      if (now - stateStart >= 300) {
        digitalWrite(DRAIN_PIN, LOW);
        Serial.println("STATE=DONE");
        state = IDLE;
      }
      break;
  }
}

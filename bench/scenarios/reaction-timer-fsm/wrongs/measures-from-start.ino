// WRONG (reaction_timer_fsm): measures the reaction time from the START press
// instead of from when the LED turned on, so REACTION_MS includes the 1000 ms wait
// and is ~1000 too large. The FSM is otherwise correct. Fails the decoded-value
// contract. expectFailCategory: serial-value.

const int START_BTN = 2;
const int STOP_BTN = 3;
const int LED_PIN = 8;
const unsigned long DEBOUNCE_MS = 30;
const unsigned long WAIT_MS = 1000;

int sStable = HIGH, sLast = HIGH; unsigned long sChange = 0;
int pStable = HIGH, pLast = HIGH; unsigned long pChange = 0;

enum State { IDLE, WAITING, REACT };
State state = IDLE;
unsigned long startTime = 0;

bool pressed(int pin, int &stable, int &last, unsigned long &change) {
  int r = digitalRead(pin);
  if (r != last) { last = r; change = millis(); }
  if (millis() - change >= DEBOUNCE_MS && r != stable) {
    stable = r;
    if (stable == LOW) return true;
  }
  return false;
}

void setup() {
  pinMode(START_BTN, INPUT_PULLUP);
  pinMode(STOP_BTN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.begin(115200);
}

void loop() {
  bool startPress = pressed(START_BTN, sStable, sLast, sChange);
  bool stopPress = pressed(STOP_BTN, pStable, pLast, pChange);
  unsigned long now = millis();

  if (state == IDLE) {
    if (startPress) { state = WAITING; startTime = now; }
  } else if (state == WAITING) {
    if (stopPress) { Serial.println("FALSE_START"); state = IDLE; }
    else if (now - startTime >= WAIT_MS) { state = REACT; digitalWrite(LED_PIN, HIGH); }
  } else {
    if (stopPress) {
      digitalWrite(LED_PIN, LOW);
      Serial.print("REACTION_MS=");
      Serial.println(now - startTime); // BUG: from START, not from LED-on
      state = IDLE;
    }
  }
}

// reaction_timer_fsm (OS-D3-03) — reference solution.
// START button D2, STOP button D3 (both INPUT_PULLUP, 30 ms debounce). Cue LED D8.
// IDLE → accepted START starts a 1000 ms wait. A STOP during the wait is a false
// start: keep the LED off and print FALSE_START. Otherwise the LED turns on after
// 1000 ms; the first accepted STOP after that turns it off and prints
// REACTION_MS=<ms since the LED turned on>, then returns to IDLE. Extra STARTs while
// active and extra STOPs while IDLE are ignored.

const int START_BTN = 2;
const int STOP_BTN = 3;
const int LED_PIN = 8;
const unsigned long DEBOUNCE_MS = 30;
const unsigned long WAIT_MS = 1000;

int sStable = HIGH, sLast = HIGH; unsigned long sChange = 0;
int pStable = HIGH, pLast = HIGH; unsigned long pChange = 0;

enum State { IDLE, WAITING, REACT };
State state = IDLE;
unsigned long waitStart = 0, ledOnTime = 0;

// Returns true once, on a debounced press (HIGH→LOW that has been stable 30 ms).
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
    if (startPress) { state = WAITING; waitStart = now; } // extra STOP ignored
  } else if (state == WAITING) {
    if (stopPress) { Serial.println("FALSE_START"); state = IDLE; } // false start
    else if (now - waitStart >= WAIT_MS) { state = REACT; digitalWrite(LED_PIN, HIGH); ledOnTime = now; }
    // extra START ignored
  } else { // REACT
    if (stopPress) {
      digitalWrite(LED_PIN, LOW);
      Serial.print("REACTION_MS=");
      Serial.println(now - ledOnTime);
      state = IDLE;
    }
    // extra START ignored
  }
}

// WRONG (reaction_timer_fsm): implements the 1000 ms wait with a blocking delay(),
// so it cannot detect a STOP pressed DURING the wait. A false start is missed: the
// LED still turns on after the delay and no FALSE_START is printed. Fails the
// pin-state contract on the false-start variant (the LED must stay off).
// expectFailCategory: pin-state.

const int START_BTN = 2;
const int STOP_BTN = 3;
const int LED_PIN = 8;
const unsigned long DEBOUNCE_MS = 30;

int sStable = HIGH, sLast = HIGH; unsigned long sChange = 0;
int pStable = HIGH, pLast = HIGH; unsigned long pChange = 0;

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
  if (pressed(START_BTN, sStable, sLast, sChange)) {
    delay(1000);                    // BUG: blocks — a STOP during the wait is lost
    digitalWrite(LED_PIN, HIGH);
    unsigned long ledOnTime = millis();
    while (!pressed(STOP_BTN, pStable, pLast, pChange)) { /* spin */ }
    digitalWrite(LED_PIN, LOW);
    Serial.print("REACTION_MS=");
    Serial.println(millis() - ledOnTime);
  }
}

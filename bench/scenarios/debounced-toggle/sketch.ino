// debounced_toggle (OS-D2-02) — reference solution.
// Button D2 (INPUT_PULLUP, to GND): released=HIGH, pressed=LOW.
// Active-low LED on D7 (LOW = on). Toggle once per DEBOUNCED press; a level must
// be stable for >=30 ms before it counts; holding does not repeat — a further
// toggle needs a debounced release then a new debounced press.

const int BTN_PIN = 2;
const int LED_PIN = 7;
const unsigned long DEBOUNCE_MS = 30;

int ledState = HIGH;        // active-low: HIGH = off at startup
int stableLevel = HIGH;     // debounced button level (HIGH = released)
int lastReading = HIGH;
unsigned long lastChangeMs = 0;

void setup() {
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, ledState);
}

void loop() {
  int reading = digitalRead(BTN_PIN);
  if (reading != lastReading) {
    lastReading = reading;
    lastChangeMs = millis();
  }
  if (millis() - lastChangeMs >= DEBOUNCE_MS && reading != stableLevel) {
    stableLevel = reading;
    if (stableLevel == LOW) {            // a newly debounced press
      ledState = (ledState == HIGH) ? LOW : HIGH;
      digitalWrite(LED_PIN, ledState);
    }
  }
}

// WRONG (four_mode_indicator): correct mode cycling and blink frequencies, but it
// never pulses the buzzer on an accepted press (D3 stays LOW). Fails the pin-state
// contract on the buzzer pulse. expectFailCategory: pin-state.

const int BTN_PIN = 2;
const int LED_PIN = 4;
const int BUZ_PIN = 3;
const unsigned long DEBOUNCE_MS = 30;

const unsigned long HALF_MS[4] = { 0, 500, 250, 125 };

int mode = 0;
int stableBtn = HIGH, lastReading = HIGH;
unsigned long lastChangeMs = 0;
bool ledOn = false;
unsigned long ledT = 0;

void setup() {
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZ_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZ_PIN, LOW);
}

void loop() {
  unsigned long now = millis();
  int reading = digitalRead(BTN_PIN);
  if (reading != lastReading) { lastReading = reading; lastChangeMs = now; }
  if (now - lastChangeMs >= DEBOUNCE_MS && reading != stableBtn) {
    stableBtn = reading;
    if (stableBtn == LOW) {
      mode = (mode + 1) % 4;
      ledOn = false; digitalWrite(LED_PIN, LOW); ledT = now;
      // BUG: no buzzer pulse.
    }
  }
  unsigned long half = HALF_MS[mode];
  if (half == 0) {
    if (ledOn) { ledOn = false; digitalWrite(LED_PIN, LOW); }
  } else if (now - ledT >= half) {
    ledT = now; ledOn = !ledOn; digitalWrite(LED_PIN, ledOn);
  }
}

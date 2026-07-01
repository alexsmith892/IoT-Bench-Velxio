// WRONG (four_mode_indicator): the per-mode blink frequencies are wrong — SLOW runs
// at 2 Hz, MEDIUM at 4 Hz, FAST at 8 Hz (each one step too fast). Debounce and
// buzzer are correct. Fails the frequency contract. expectFailCategory: frequency.

const int BTN_PIN = 2;
const int LED_PIN = 4;
const int BUZ_PIN = 3;
const unsigned long DEBOUNCE_MS = 30;
const unsigned long BUZZ_MS = 50;

// BUG: half-periods one mode too fast (250/125/62 instead of 500/250/125).
const unsigned long HALF_MS[4] = { 0, 250, 125, 62 };

int mode = 0;
int stableBtn = HIGH, lastReading = HIGH;
unsigned long lastChangeMs = 0;
bool ledOn = false;
unsigned long ledT = 0;
bool buzzing = false;
unsigned long buzStart = 0;

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
      buzzing = true; buzStart = now; digitalWrite(BUZ_PIN, HIGH);
    }
  }
  if (buzzing && now - buzStart >= BUZZ_MS) { buzzing = false; digitalWrite(BUZ_PIN, LOW); }
  unsigned long half = HALF_MS[mode];
  if (half == 0) {
    if (ledOn) { ledOn = false; digitalWrite(LED_PIN, LOW); }
  } else if (now - ledT >= half) {
    ledT = now; ledOn = !ledOn; digitalWrite(LED_PIN, ledOn);
  }
}

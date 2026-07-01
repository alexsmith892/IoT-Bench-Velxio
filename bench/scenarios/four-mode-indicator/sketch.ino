// four_mode_indicator (OS-D3-01) — reference solution.
// Button D2 (INPUT_PULLUP, 30 ms debounce) advances one mode per press:
//   0 OFF (LED low), 1 SLOW 1 Hz, 2 MEDIUM 2 Hz, 3 FAST 4 Hz, then wraps to OFF.
// Active-high LED on D4, active buzzer on D3. Each accepted press pulses the buzzer
// HIGH for 50 ms. Blinking, debounce, and buzzer timing all run concurrently
// (non-blocking).

const int BTN_PIN = 2;
const int LED_PIN = 4;
const int BUZ_PIN = 3;
const unsigned long DEBOUNCE_MS = 30;
const unsigned long BUZZ_MS = 50;

// Half-period per mode (ms); 0 = no blink.
const unsigned long HALF_MS[4] = { 0, 500, 250, 125 };

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

  // Debounce → advance one mode per accepted press.
  int reading = digitalRead(BTN_PIN);
  if (reading != lastReading) { lastReading = reading; lastChangeMs = now; }
  if (now - lastChangeMs >= DEBOUNCE_MS && reading != stableBtn) {
    stableBtn = reading;
    if (stableBtn == LOW) {                 // accepted press
      mode = (mode + 1) % 4;
      ledOn = false; digitalWrite(LED_PIN, LOW); ledT = now; // restart blink phase
      buzzing = true; buzStart = now; digitalWrite(BUZ_PIN, HIGH); // pulse buzzer
    }
  }

  // Buzzer pulse off after 50 ms (non-blocking).
  if (buzzing && now - buzStart >= BUZZ_MS) { buzzing = false; digitalWrite(BUZ_PIN, LOW); }

  // Blink per mode.
  unsigned long half = HALF_MS[mode];
  if (half == 0) {
    if (ledOn) { ledOn = false; digitalWrite(LED_PIN, LOW); }
  } else if (now - ledT >= half) {
    ledT = now; ledOn = !ledOn; digitalWrite(LED_PIN, ledOn);
  }
}

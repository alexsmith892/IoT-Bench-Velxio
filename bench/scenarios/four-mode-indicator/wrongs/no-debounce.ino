// WRONG (four_mode_indicator): advances the mode on every raw falling edge with no
// debounce. A bouncing press advances two (or more) modes at once, so the mode (and
// therefore the blink frequency) is wrong after a bounced press. Fails the frequency
// contract on the debounce variant. expectFailCategory: frequency.

const int BTN_PIN = 2;
const int LED_PIN = 4;
const int BUZ_PIN = 3;
const unsigned long BUZZ_MS = 50;

const unsigned long HALF_MS[4] = { 0, 500, 250, 125 };

int mode = 0;
int lastReading = HIGH;
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
  if (lastReading == HIGH && reading == LOW) {  // raw falling edge, no debounce
    mode = (mode + 1) % 4;
    ledOn = false; digitalWrite(LED_PIN, LOW); ledT = now;
    buzzing = true; buzStart = now; digitalWrite(BUZ_PIN, HIGH);
  }
  lastReading = reading;

  if (buzzing && now - buzStart >= BUZZ_MS) { buzzing = false; digitalWrite(BUZ_PIN, LOW); }
  unsigned long half = HALF_MS[mode];
  if (half == 0) {
    if (ledOn) { ledOn = false; digitalWrite(LED_PIN, LOW); }
  } else if (now - ledT >= half) {
    ledT = now; ledOn = !ledOn; digitalWrite(LED_PIN, ledOn);
  }
}

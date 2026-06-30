// active_low_interlock (OS-D1-01) — reference solution.
// Button on D2 (INPUT_PULLUP, to GND): released=HIGH, pressed=LOW.
// LED on D7 through an inverting stage → active-low: LOW = on, HIGH = off.
// LED off at startup; on while pressed, off while released; follow continuously.

const int BUTTON_PIN = 2;
const int LED_PIN = 7;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // active-low: HIGH = off
}

void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;
  digitalWrite(LED_PIN, pressed ? LOW : HIGH);
}

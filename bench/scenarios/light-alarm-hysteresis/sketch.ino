// light_alarm_hysteresis (OS-D2-03) — reference solution.
// Light sensor ADC on A2; active-high warning LED on D6.
// LED on at reading <= 350, off at reading >= 450, HOLD state in between.
// LED starts off. Sample at least every 20 ms.

const int SENSOR_PIN = A2;
const int LED_PIN = 6;
const int ON_AT = 350;   // reading <= 350 -> on
const int OFF_AT = 450;  // reading >= 450 -> off

bool alarmOn = false;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // off
}

void loop() {
  int reading = analogRead(SENSOR_PIN);
  if (reading <= ON_AT) {
    alarmOn = true;
  } else if (reading >= OFF_AT) {
    alarmOn = false;
  } // strictly between: retain previous state
  digitalWrite(LED_PIN, alarmOn ? HIGH : LOW);
  delay(20);
}

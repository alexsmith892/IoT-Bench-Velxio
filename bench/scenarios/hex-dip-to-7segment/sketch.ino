// hex_dip_to_7segment (OS-D1-05) — reference solution.
// DIP switches D2..D5 (INPUT_PULLUP, closed = LOW = 1; D2 = bit0, D5 = bit3) form
// a 4-bit value. Common-cathode seven-segment: segments a..g on D6..D12, active-high.
// Show the value as one uppercase hex digit (A b C d E F for 10..15).

const int SW_PINS[4] = {2, 3, 4, 5};      // bit 0..3
const int SEG_PINS[7] = {6, 7, 8, 9, 10, 11, 12}; // a..g

// Bit 6 = segment a … bit 0 = segment g (active-high).
const byte FONT[16] = {
  0b1111110, // 0
  0b0110000, // 1
  0b1101101, // 2
  0b1111001, // 3
  0b0110011, // 4
  0b1011011, // 5
  0b1011111, // 6
  0b1110000, // 7
  0b1111111, // 8
  0b1111011, // 9
  0b1110111, // A
  0b0011111, // b
  0b1001110, // C
  0b0111101, // d
  0b1001111, // E
  0b1000111, // F
};

void setup() {
  for (int i = 0; i < 4; i++) pinMode(SW_PINS[i], INPUT_PULLUP);
  for (int i = 0; i < 7; i++) pinMode(SEG_PINS[i], OUTPUT);
}

void loop() {
  int value = 0;
  for (int i = 0; i < 4; i++) {
    if (digitalRead(SW_PINS[i]) == LOW) value |= (1 << i);
  }
  byte pattern = FONT[value];
  for (int i = 0; i < 7; i++) {
    digitalWrite(SEG_PINS[i], (pattern >> (6 - i)) & 1 ? HIGH : LOW);
  }
}

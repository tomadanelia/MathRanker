begin;

insert into public.questions (
  category,
  body,
  type,
  correct_answer,
  accepted_answers,
  tolerance,
  explanation,
  difficulty,
  status,
  body_hash
)
values
  ('arithmetic', 'What is 18 + 27?', 'numeric', '45', '{}', 0, 'Add the tens and ones: 18 + 27 = 45.', 1200, 'active', md5('What is 18 + 27?')),
  ('arithmetic', 'What is 72 divided by 8?', 'numeric', '9', '{}', 0, '8 multiplied by 9 is 72.', 1200, 'active', md5('What is 72 divided by 8?')),
  ('arithmetic', 'What is 15% of 80?', 'numeric', '12', '{}', 0, 'Ten percent is 8 and five percent is 4, for a total of 12.', 1300, 'active', md5('What is 15% of 80?')),
  ('arithmetic', 'What is 3 squared plus 4 squared?', 'numeric', '25', '{}', 0, '3 squared is 9 and 4 squared is 16; 9 + 16 = 25.', 1350, 'active', md5('What is 3 squared plus 4 squared?')),
  ('arithmetic', 'What is the square root of 144?', 'numeric', '12', '{}', 0, '12 multiplied by 12 is 144.', 1250, 'active', md5('What is the square root of 144?')),
  ('arithmetic', 'What is one third plus one sixth?', 'numeric', '0.5', '{1/2}', 0, 'One third is two sixths, so the sum is three sixths, or one half.', 1400, 'active', md5('What is one third plus one sixth?')),
  ('arithmetic', 'What is 7 times 8 minus 13?', 'numeric', '43', '{}', 0, '7 times 8 is 56, and 56 minus 13 is 43.', 1250, 'active', md5('What is 7 times 8 minus 13?')),
  ('arithmetic', 'What is 2.5 times 4?', 'numeric', '10', '{}', 0, '25 times 4 is 100, then place the decimal to get 10.', 1200, 'active', md5('What is 2.5 times 4?')),
  ('arithmetic', 'What is 120 divided by 0.25?', 'numeric', '480', '{}', 0, 'Dividing by one quarter is the same as multiplying by 4.', 1500, 'active', md5('What is 120 divided by 0.25?')),
  ('arithmetic', 'What is 2 to the power of 5 minus 7?', 'numeric', '25', '{}', 0, '2 to the power of 5 is 32, and 32 minus 7 is 25.', 1350, 'active', md5('What is 2 to the power of 5 minus 7?')),

  ('algebra', 'Solve for x: x + 9 = 17.', 'numeric', '8', '{}', 0, 'Subtract 9 from both sides.', 1200, 'active', md5('Solve for x: x + 9 = 17.')),
  ('algebra', 'Solve for x: 4x = 36.', 'numeric', '9', '{}', 0, 'Divide both sides by 4.', 1200, 'active', md5('Solve for x: 4x = 36.')),
  ('algebra', 'Solve for x: 5x - 7 = 18.', 'numeric', '5', '{}', 0, 'Add 7, then divide 25 by 5.', 1250, 'active', md5('Solve for x: 5x - 7 = 18.')),
  ('algebra', 'Solve for x: 2(x + 3) = 20.', 'numeric', '7', '{}', 0, 'Divide by 2, then subtract 3.', 1300, 'active', md5('Solve for x: 2(x + 3) = 20.')),
  ('algebra', 'Solve for x: 3x + 2x = 35.', 'numeric', '7', '{}', 0, 'Combine like terms to get 5x = 35.', 1200, 'active', md5('Solve for x: 3x + 2x = 35.')),
  ('algebra', 'Solve for x: x divided by 4 plus 3 equals 8.', 'numeric', '20', '{}', 0, 'Subtract 3, then multiply by 4.', 1300, 'active', md5('Solve for x: x divided by 4 plus 3 equals 8.')),
  ('algebra', 'Solve for x: 2x - 3 = x + 9.', 'numeric', '12', '{}', 0, 'Subtract x and add 3 to isolate x.', 1400, 'active', md5('Solve for x: 2x - 3 = x + 9.')),
  ('algebra', 'What is the positive solution to (x - 1) squared = 16?', 'numeric', '5', '{}', 0, 'The positive square root gives x - 1 = 4, so x = 5.', 1500, 'active', md5('What is the positive solution to (x - 1) squared = 16?')),
  ('algebra', 'Solve for x: 4(x - 2) = 3x + 5.', 'numeric', '13', '{}', 0, 'Expand to 4x - 8 = 3x + 5, then subtract 3x and add 8.', 1500, 'active', md5('Solve for x: 4(x - 2) = 3x + 5.')),
  ('algebra', 'If y = 3x and x = 6, what is y?', 'numeric', '18', '{}', 0, 'Substitute 6 for x: y = 3 times 6.', 1150, 'active', md5('If y = 3x and x = 6, what is y?')),

  ('geometry', 'A rectangle is 8 units long and 5 units wide. What is its area?', 'numeric', '40', '{}', 0, 'Rectangle area is length times width.', 1200, 'active', md5('A rectangle is 8 units long and 5 units wide. What is its area?')),
  ('geometry', 'What is the perimeter of a square with side length 6?', 'numeric', '24', '{}', 0, 'A square has four equal sides: 4 times 6.', 1200, 'active', md5('What is the perimeter of a square with side length 6?')),
  ('geometry', 'Two angles in a triangle are 35 and 65 degrees. What is the third angle in degrees?', 'numeric', '80', '{}', 0, 'Triangle angles sum to 180 degrees.', 1300, 'active', md5('Two angles in a triangle are 35 and 65 degrees. What is the third angle in degrees?')),
  ('geometry', 'A circle has radius 5. Using pi = 3.14, what is its circumference?', 'numeric', '31.4', '{}', 0.01, 'Circumference is 2 times pi times the radius.', 1450, 'active', md5('A circle has radius 5. Using pi = 3.14, what is its circumference?')),
  ('geometry', 'A triangle has base 12 and height 7. What is its area?', 'numeric', '42', '{}', 0, 'Triangle area is one half times base times height.', 1350, 'active', md5('A triangle has base 12 and height 7. What is its area?')),
  ('geometry', 'A rectangle has length 9 and width 4. What is its area?', 'numeric', '36', '{}', 0, 'Rectangle area is length times width.', 1200, 'active', md5('A rectangle has length 9 and width 4. What is its area?')),
  ('geometry', 'What is the volume of a cube with side length 3?', 'numeric', '27', '{}', 0, 'Cube volume is side length cubed: 3 times 3 times 3.', 1300, 'active', md5('What is the volume of a cube with side length 3?')),
  ('geometry', 'A right triangle has legs 6 and 8. What is the hypotenuse length?', 'numeric', '10', '{}', 0, 'By the Pythagorean theorem, the hypotenuse is the square root of 36 + 64.', 1400, 'active', md5('A right triangle has legs 6 and 8. What is the hypotenuse length?')),
  ('geometry', 'An isosceles triangle has two equal angles of 55 degrees. What is the third angle?', 'numeric', '70', '{}', 0, 'Subtract 55 + 55 from 180 degrees.', 1350, 'active', md5('An isosceles triangle has two equal angles of 55 degrees. What is the third angle?')),
  ('geometry', 'A parallelogram has base 11 and height 4. What is its area?', 'numeric', '44', '{}', 0, 'Parallelogram area is base times perpendicular height.', 1300, 'active', md5('A parallelogram has base 11 and height 4. What is its area?'))
on conflict (body_hash) do nothing;

commit;

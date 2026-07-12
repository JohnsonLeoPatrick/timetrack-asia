// Test validation

// Since createRegistrationAction is a Next.js Server Action, it expects Next.js server context (cookies, headers, etc.)
// Let's see if we can run it or if we can inspect the Zod schemas directly.
const { z } = require('zod');

const billingSchema = z.object({
  first_name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  country: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
});

const participantSchema = z.object({
  category_id: z.string().uuid(),
  full_name: z.string().min(1),
  bib_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  ic_passport: z.string().optional(),
  dob: z.string().optional(),
  age: z.number().optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  medical_status: z.boolean().optional(),
  medical_details: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
});

function testValidation() {
  const billing = { first_name: 'Test User', phone: '+60123456789', email: 'user@gmail.com' };
  
  // This is what the UI emptyParticipant generates:
  const participant = {
    category_id: 'c31d6e4e-2791-4fe5-a126-ef3cec0da61e',
    full_name: '', bib_name: '', email: '', phone: '', gender: '',
    ic_passport: '', dob: '', age: null, address: '', postcode: '',
    country: 'Malaysia', medical_status: false, medical_details: '',
    emergency_name: '', emergency_phone: '',
  };

  try {
    console.log('Validating billing...');
    billingSchema.parse(billing);
    console.log('Billing valid.');
  } catch (e) {
    console.error('Billing validation failed:', e.errors);
  }

  try {
    console.log('Validating participant...');
    participantSchema.parse(participant);
    console.log('Participant valid.');
  } catch (e) {
    console.error('Participant validation failed:', e.errors);
  }
}

testValidation();

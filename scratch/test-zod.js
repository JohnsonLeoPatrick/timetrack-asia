const { z } = require('zod');

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

const participant = {
  category_id: 'c31d6e4e-2791-4fe5-a126-ef3cec0da61e',
  full_name: '', bib_name: '', email: '', phone: '', gender: '',
  ic_passport: '', dob: '', age: null, address: '', postcode: '',
  country: 'Malaysia', medical_status: false, medical_details: '',
  emergency_name: '', emergency_phone: '',
};

const result = participantSchema.safeParse(participant);
if (!result.success) {
  console.log(JSON.stringify(result.error.format(), null, 2));
} else {
  console.log('Valid!');
}

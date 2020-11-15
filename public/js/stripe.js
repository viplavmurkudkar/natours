/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

const stripe = Stripe(
  'pk_test_51HnP91JKbWQ6AUfFJL6d2YvHZNPWvmej5O0Q2v3tpWBEQfKcuCWvIRqmflvpuAFHiwXstZgftT0kAQG7PF38a6HE0060y4Pxuq'
); //pass in public key

export const bookTour = async tourID => {
  try {
    // 1) Get checkout session from API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourID}`
    );
    console.log(session);

    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};

import React from 'react';
import '../assets/styles/ContactUs.css';

const ContactUs = () => {
    const handleSubmit = (e) => {
        e.preventDefault();
        alert('Your message has been sent! We will get back to you soon.');
        e.target.reset();
    };

    return (
        <div>
            <h1>We'd love to hear from you! Feel free to fill the form below.</h1>

            <div id="container">
                <form id="contactForm" onSubmit={handleSubmit}>
                    <label htmlFor="name">Your Name</label>
                    <input type="text" name="name" id="name" placeholder="Enter Your Name" required />

                    <label htmlFor="email">Your E-mail</label>
                    <input type="email" name="email" id="email" placeholder="Enter Your E-mail" required />

                    <label htmlFor="subject">Subject</label>
                    <input type="text" name="subject" id="subject" placeholder="Enter the Subject" />

                    <textarea name="message" id="message" placeholder="Write Your Message Here..."></textarea>
                    
                    <button type="submit">Send Message</button>
                </form>

                <div className="contact-info">
                    <p><i className="fas fa-phone-alt"></i> Phone: +91-1234567890</p>
                    <p><i className="fas fa-envelope"></i> Email: support@example.com</p>
                    <p><i className="fas fa-map-marker-alt"></i> Address: ABC Road, City, Country</p>
                </div>
            </div>
        </div>
    );
};

export default ContactUs;


import mongoose from 'mongoose';
import { GoogleCalendar } from './src/models/GoogleCalendar';
import { googleCalendarService } from './src/services/googleCalendarService';
import dotenv from 'dotenv';

dotenv.config();

async function testUnifiedEvents() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cuvera-core');
        console.log('Connected to MongoDB');

        const timestamp = Date.now();
        
        // 1. Create a mock recurring master event
        const masterEventId = `test_recurring_${timestamp}`;
        await GoogleCalendar.create({
            eventId: masterEventId,
            summary: 'Test Recurring Master',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3600000).toISOString(),
            isRecurring: true,
            recurrenceRule: 'FREQ=DAILY;COUNT=5',
            isMessageSent: true // Master doesn't get sent
        });
        console.log(`Created master event: ${masterEventId}`);

        // 2. Create a mock normal event (unsent)
        const normalEventId = `test_normal_${timestamp}`;
        await GoogleCalendar.create({
            eventId: normalEventId,
            summary: 'Test Normal Event',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3600000).toISOString(),
            isRecurring: false,
            isMessageSent: false // Should be picked up
        });
        console.log(`Created normal unsent event: ${normalEventId}`);

        // 3. Trigger processing
        console.log('Triggering processCalendarEvents...');
        await googleCalendarService.processCalendarEvents();

        // 4. Verify Recurring Instances
        const instances = await GoogleCalendar.find({ recurringEventId: masterEventId });
        console.log(`Found ${instances.length} instances generated.`);
        
        // 5. Verify Normal Event Status
        const normalEvent = await GoogleCalendar.findOne({ eventId: normalEventId });
        console.log(`Normal event sent status: ${normalEvent?.isMessageSent}`);

        if (instances.length > 0 && normalEvent?.isMessageSent) {
            console.log('✅ SUCCESS: Both recurring instances generated AND normal event processed.');
        } else {
            console.error('❌ FAILURE: Check logs.');
        }

        // Cleanup
        await GoogleCalendar.deleteMany({ 
            $or: [
                { eventId: masterEventId }, 
                { recurringEventId: masterEventId },
                { eventId: normalEventId }
            ] 
        });
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testUnifiedEvents();

# Carrier Bid Workflow

## Overview
This document describes the complete automated carrier bidding system for freight requests, including RFQ sending, bid collection, counter-offer negotiation, and customer notification.

## Status Flow

```
pending_details → details_complete → bid_sent → bid_received → rebid_received → quoted
```

### Status Definitions

- **pending_details**: Initial state when email is received but missing required fields
- **details_complete**: All required fields present, ready for RFQ sending
- **bid_sent**: RFQs sent to carriers, waiting for bids
- **bid_received**: Received 2+ bids, ready for counter-offers
- **rebid_received**: Bidding process complete (follow-ups sent or max extensions reached)
- **quoted**: Customer has been quoted (manual or auto)

## Full Workflow

### 1. Email Reception and Freight Details Extraction

```
📧 Email Received
    ↓
Extract Freight Details (LLM-style regex)
    ↓
Check Required Fields (origin, destination, weight, freight type, pickup date)
    ↓
All fields present?
    ├─ No → Status: pending_details → Ask customer for missing fields
    └─ Yes → Status: details_complete → Auto-trigger RFQ sending
```

### 2. RFQ Sending

```
Status: details_complete
    ↓
Auto-trigger RFQ Sending
    ↓
Select Carriers (via carrier selection service)
    ↓
Send RFQ Emails to Carriers
    ↓
Status: bid_sent
    ↓
⏰ Set Individual Timer (1 minute for testing, 2 hours for production)
```

**RFQ Email Template:**
- Quote ID
- Freight details (origin, destination, weight, etc.)
- Deadline message (1 minute for testing)
- Request for price quote

### 3. Bid Collection and Deadline Management

```
⏰ Timer Fires (1 minute after RFQ send)
    ↓
Check Bid Count
    ├─ ≥2 bids → Status: bid_received → Send counter-offers
    └─ <2 bids → Extend deadline by 30 seconds (1 time max)
```

**Deadline Extension Logic:**
- If <2 bids received → Extend deadline by 30 seconds
- Set new timer for 30 seconds
- Maximum 1 extension allowed
- If max extensions reached → Send best available price to customer

### 4. Counter-Offer Sending

```
Status: bid_received with ≥2 bids
    ↓
Find Lowest Bid
    ↓
Send Counter-Offer to Non-Lowest Bidders
    ↓
Email Template: "Can you beat $[lowest_price]?"
    ↓
Status: rebid_received
```

**Counter-Offer Email Features:**
- Sent as thread reply to original RFQ
- Shows current lowest price
- Asks carriers to beat the price
- Only sent to carriers who are not the lowest bidder

### 5. Carrier Reply Processing

```
📧 Carrier Reply Received
    ↓
Extract Bid Details (LLM-style regex)
    ↓
Check if Counter-Offer Reply (existing bid exists)
    ├─ Yes → Update existing bid with new price (phase = "rebid")
    │   ├─ Find lowest bid across all carriers
    │   └─ Send best price to customer (if conditions met)
    │
    └─ No → Save as new bid (phase = "initial")
        └─ Update freight status if ≥2 bids
```

**Bid Extraction Patterns:**
- Standard price patterns: `$850.00`, `price: $850`
- Counter-offer patterns: `My new bid: $675.00`, `I can beat that price of $699.00`
- Final offer patterns: `Best and final: $650.00`

### 6. Customer Notification

```
Check Conditions for Customer Notification:
    ↓
Condition 1: Must have at least 1 bid ✓
Condition 2: Freight request must exist ✓
Condition 3: Counter-offer OR deadline passed ✓
Condition 4: Price must be valid (> 0) ✓
    ↓
All conditions met?
    ├─ Yes → Send email to customer with best price
    └─ No → Log reason, do not send
```

**Customer Notification Triggers:**
- Counter-offer reply received from carrier
- Deadline passes (freight status = rebid_received)
- Max extensions reached with <2 bids

**Customer Email Template:**
- Quote ID
- Best price
- Carrier name
- Confirmation request

### 7. Auto-Recovery System

```
🤖 Auto-Recovery Runs Every 60 Seconds
    ↓
Check for Stuck Freight Requests
    ├─ Status: details_complete without RFQs → Send RFQs + Set timer
    └─ Status: bid_received too long → Force to rebid status
```

## Timer Management

### Individual Timer Approach
- Each freight request gets its own timer when RFQs are sent
- Timer fires exactly at deadline (no polling)
- Extension sets new timer (recursive)
- More efficient than polling every 30 seconds

### Timer Events
1. **Initial Timer**: Set when RFQs are sent (1 minute)
2. **Extension Timer**: Set when deadline extended (30 seconds)
3. **Timer Expiry**: Triggers bid count check and follow-up logic

## Configuration

### Constants (bid.constants.ts)

```typescript
BID_DEADLINE_MINUTES = 1  // Testing: 1 minute, Production: 120 minutes
MINIMUM_BIDS_FOR_FOLLOWUP = 2
BID_EXTENSION_SECONDS = 30
MAX_EXTENSIONS = 1
```

### Freight Request Extensions
- Tracks extension count in FreightRequest entity
- Maximum 1 extension allowed
- Prevents infinite extension loops

## Database Schema

### FreightRequest Entity
- `id`: UUID
- `quoteId`: String (e.g., AMZ-00001)
- `status`: FreightRequestStatus
- `extensionCount`: Number (default: 0)
- Freight details fields
- Customer information

### CarrierRFQ Entity
- `id`: UUID
- `quoteId`: String
- `sentGmailMessageId`: String
- `sentThreadId`: String
- `carrierEmail`: String
- `status`: CarrierRFQStatus (sent, replied, no_response, processed)
- `sentAt`: DateTime
- Relations: freightRequest, carrier

### CarrierBid Entity
- `id`: UUID
- `quoteId`: String (nullable)
- `freightRequestId`: String
- `carrierId`: String
- `rfqId`: String
- `price`: Number
- `message`: String
- `phase`: String (initial, rebid)
- `gmailMessageId`: String
- `gmailThreadId`: String
- Additional fields: additionalFees, transitTime, equipmentType

## Services

### Core Services
1. **RFQ Manager Service** - Sends RFQs to carriers, sets timers
2. **Bid Deadline Service** - Checks deadlines, manages extensions
3. **Timer Manager Service** - Manages individual timers for each quote
4. **Carrier Reply Handler** - Processes carrier email replies
5. **Follow-up Email Service** - Sends counter-offer emails
6. **Customer Email Service** - Sends best price to customer
7. **Bid Followup Orchestrator** - Coordinates deadline checking
8. **Auto-Trigger Service** - Recovers stuck processes

### LLM Services
1. **Freight Extractor** - Extracts freight details from customer emails
2. **Bid Extractor** - Extracts bid details from carrier emails

## Email Thread Management

All emails are sent as thread replies:
- RFQ emails → Start new thread
- Counter-offer emails → Reply to original RFQ thread
- Customer notifications → Reply to original customer email thread

Thread IDs are stored in:
- `CarrierRFQ.sentThreadId`
- `CarrierBid.gmailThreadId`
- `FreightRequest.threadId`

## Error Handling

### Bid Extraction Failures
- If price not found → Skip bid creation
- Log error for debugging
- Continue processing other bids

### Email Sending Failures
- Catch and log errors
- Do not crash the system
- Continue processing other emails

### Timer Failures
- Catch and log errors
- Auto-recovery will handle stuck processes

## Debugging

### Console Logging
All major operations log:
- Timer set/clear events
- Bid count checks
- Condition validation for customer notification
- Extension attempts
- Email sending status
- Error details

### Common Issues
1. **No rebid emails sent** → Check freight status, timer status
2. **Premature customer notification** → Check condition validation logs
3. **Stuck processes** → Check auto-recovery logs
4. **Bid extraction failures** → Check email format against patterns

## Production vs Testing

### Testing Configuration
- `BID_DEADLINE_MINUTES = 1` (1 minute)
- `BID_EXTENSION_SECONDS = 30` (30 seconds)
- Frequent auto-recovery (60 seconds)

### Production Configuration
- `BID_DEADLINE_MINUTES = 120` (2 hours)
- `BID_EXTENSION_SECONDS = 1800` (30 minutes)
- Less frequent auto-recovery (5 minutes)

## Security Considerations

- Gmail credentials stored securely
- No sensitive data in logs (mask email addresses if needed)
- Rate limiting for Gmail API
- Input validation for all user inputs

## Future Enhancements

Potential improvements:
- Add bid acceptance workflow
- Implement carrier rating system
- Add analytics dashboard
- Support for multiple freight types
- Integration with TMS systems
- SMS notifications for urgent requests

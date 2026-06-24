import ballerinax/trigger.hubspot;

listener hubspot:Listener hubspotListener = new (listenerConfig = {clientSecret: "secret", callbackURL: "http://localhost:8090/callback"});

service hubspot:TicketService on hubspotListener {
    remote function onTicketCreation(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }

    remote function onTicketAssociationchange(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }

    remote function onTicketMerge(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }
}

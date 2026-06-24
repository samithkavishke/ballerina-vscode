import ballerinax/trigger.hubspot;

listener hubspot:Listener hubspotListener = new (listenerConfig = {clientSecret: "secret", callbackURL: "http://localhost:8090/callback"});

service hubspot:ConversationService on hubspotListener {
    remote function onConversationCreation(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }

    remote function onConversationNewmessage(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }

    remote function onConversationPrivacydeletion(hubspot:WebhookEvent event) returns error? {
        do {
        } on fail error err {
            // handle error
            return error("unhandled error", err);
        }
    }
}

function getIframeBody(index) {
    return cy
        .get(".element-container > iframe")
        .eq(index)
        .should(iframe => {
            // Wait for a known element of the iframe to exist. In this case,
            // we wait for its button to appear. This will happen after the
            // handshaking with Streamlit is done.
            expect(iframe.contents().find("canvas")).to.exist;
        })
        .then(iframe => {
            // Return a snapshot of the iframe's body, now that we know it's
            // loaded.
            return cy.wrap(iframe.contents().find("body"));
        });
}

describe('Integration Test', () => {
    beforeEach(() => {
        cy.visit("/");

        // Make the ribbon decoration line disappear
        cy.get(".decoration").invoke("css", "display", "none");
    });

    it('is rendered correctly', () => {
        cy.get(".element-container > .stMarkdown > h2").should("have.text", "End-to-end Cypress test");
        cy.get(".element-container > iframe").should("have.length", 1);
        getIframeBody(0).find("canvas").should("have.length", 3);
        cy.get(".element-container img").should("have.length", 1);
        cy.get(".element-container .stDataFrame").should("have.length", 1);
    })
})
function handleSubmit(event) {
  event.preventDefault();

  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;

  event.target.reset();

  const credentials = { email, password };

  let contentType;
  let body;
  contentType = "application/json";
  body = JSON.stringify(credentials); // JSON format

  // ------- DONE CSV or JSON ---------

  // ----- Fetching -------
  fetch("/api/signin", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
    },
    body: body,
  })
    .then((response) => response.json())

    // -- Data sent to server --
    .then((data) => {
      console.log("Response from server:", data);
      if (data.hasOwnProperty("message")) {
        alert(data.message);
      } else {
        alert(data.error);
      }
    })
    // -- Data sent to server DONE --

    .catch((error) => {
      console.error("Error:", error);
    });

  event.target.reset();
}

// Event listener to the form for form submission
document.getElementById("signin-form").addEventListener("submit", handleSubmit);

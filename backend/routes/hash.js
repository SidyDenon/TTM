import bcrypt from "bcryptjs";

const run = async () => {
  const plainPassword = "hashedpassword";
  const hash = await bcrypt.hash(plainPassword, 10);

  console.log("Mot de passe en clair :", plainPassword);
  console.log("Hash généré :", hash);
};

run();

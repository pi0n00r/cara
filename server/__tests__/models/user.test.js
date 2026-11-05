jest.mock("../../utils/prisma", () => ({
  users: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  workspace_chats: { updateMany: jest.fn() },
  $transaction: jest.fn(async (operations) => Promise.all(operations)),
}));

const prisma = require("../../utils/prisma");
const { User } = require("../../models/user");

describe("username validation restrictions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const failureMessages = [
    "Username cannot be longer than 64 characters",
    "Username must be at least 2 characters",
    "Username must start with a lowercase letter and only contain lowercase letters, numbers, underscores, hyphens, and periods",
  ];

  it("should throw an error if the username is longer than 64 characters", () => {
    expect(() => User.validations.username("a".repeat(65))).toThrow(
      failureMessages[0]
    );
  });

  it("should throw an error if the username is less than 2 characters", () => {
    expect(() => User.validations.username("a")).toThrow(failureMessages[1]);
  });

  it("should throw an error if the username does not start with a lowercase letter", () => {
    expect(() => User.validations.username("Aa1")).toThrow(failureMessages[2]);
  });

  it("should throw an error if the username contains invalid characters", () => {
    expect(() => User.validations.username("ad-123_456.789*")).toThrow(
      failureMessages[2]
    );
    expect(() => User.validations.username("ad-123_456#456")).toThrow(
      failureMessages[2]
    );
    expect(() => User.validations.username("ad-123_456!456")).toThrow(
      failureMessages[2]
    );
  });

  it("should return the username if it is valid or an email address", () => {
    expect(User.validations.username("a123_456.789@")).toBe("a123_456.789@");
    expect(User.validations.username("a123_456.789@example.com")).toBe(
      "a123_456.789@example.com"
    );
  });

  it("should throw an error if the username is not a string", () => {
    expect(() => User.validations.username(123)).toThrow(failureMessages[2]);
    expect(() => User.validations.username(null)).not.toThrow();
    expect(() => User.validations.username(undefined)).toThrow(
      failureMessages[1]
    );
    expect(() => User.validations.username({})).toThrow(failureMessages[3]);
    expect(() => User.validations.username([])).toThrow(failureMessages[3]);
    expect(() => User.validations.username(true)).not.toThrow();
    expect(() => User.validations.username(false)).not.toThrow();
  });
});

describe("user deletion chat retention", () => {
  beforeEach(() => jest.clearAllMocks());

  it("detaches retained chats without revealing reset history", async () => {
    prisma.users.findMany.mockResolvedValue([{ id: 7 }]);
    prisma.workspace_chats.updateMany.mockResolvedValue({ count: 2 });
    prisma.users.deleteMany.mockResolvedValue({ count: 1 });

    await expect(User.delete({ id: 7 })).resolves.toBe(true);

    expect(prisma.workspace_chats.updateMany).toHaveBeenCalledWith({
      where: { user_id: 7 },
      data: {
        user_id: null,
        thread_id: null,
        api_session_id: "retained-deleted-user:7",
      },
    });
  });
});

import { useCallback, useContext, useState } from "react";
import useAgents from "@/hooks/useAgents.ts";
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { EthernetPort } from "lucide-react";
import { useApi } from "@/hooks/useApi.ts";
import { LigoloAgent } from "@/types/agents.ts";
import ErrorContext from "@/contexts/Error.tsx";
import { listenerSchema } from "@/schemas/listeners.ts";

interface ListenerCreationProps {
  isOpen?: boolean;
  onOpenChange?: () => void;
  mutate?: () => Promise<unknown>;
  agentId?: number;
}

export function ListenerCreationModal({
  isOpen,
  onOpenChange,
  mutate,
  agentId,
}: ListenerCreationProps) {
  const [selectedAgent, setSelectedAgent] = useState(agentId);
  const [listenerProtocol, setListenerProtocol] = useState("tcp");
  const [redirectAddr, setRedirectAddr] = useState("");
  const [listenerAddr, setListenerAddr] = useState("");
  const [shadowPort, setShadowPort] = useState(false);
  const [shadowInternalPort, setShadowInternalPort] = useState("8445");
  const [shadowSource, setShadowSource] = useState("");

  const { post } = useApi();
  const { agents } = useAgents();
  const { setError } = useContext(ErrorContext);
  const [formErrors, setFormErrors] = useState({});
  const shadowPortAvailable =
    selectedAgent !== undefined &&
    agents?.[selectedAgent]?.Capabilities?.includes("shadowport-smb-v1");

  const addInterface = useCallback(
    (callback: () => unknown) => async () => {
      const result = listenerSchema.safeParse({
        redirectAddr,
        listenerAddr,
        agentId: selectedAgent,
        shadowPort,
        shadowInternalPort,
        shadowSource,
      });

      if (!result.success) {
        setFormErrors(result.error.flatten().fieldErrors);
        return;
      }

      setFormErrors({});

      await post("api/v1/listeners", {
        listenerAddr,
        redirectAddr,
        agentId: selectedAgent,
        network: listenerProtocol,
        shadowPort: shadowPort
          ? {
              internalPort: Number(shadowInternalPort),
              allowedSources: shadowSource
                .split(",")
                .map((source) => source.trim())
                .filter(Boolean),
            }
          : undefined,
      }).catch(setError);

      if (mutate) mutate();
      if (callback) callback();
    },
    [
      mutate,
      selectedAgent,
      listenerAddr,
      redirectAddr,
      listenerProtocol,
      shadowPort,
      shadowInternalPort,
      shadowSource,
      post,
      setError,
    ],
  );

  return (
    <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Add a new listener
            </ModalHeader>
            <ModalBody>
              <Form validationErrors={formErrors}>
                <Select
                  onSelectionChange={(keys) => {
                    const nextAgent = Number(keys.currentKey);
                    setSelectedAgent(nextAgent);
                    if (
                      !agents?.[nextAgent]?.Capabilities?.includes(
                        "shadowport-smb-v1",
                      )
                    ) {
                      setShadowPort(false);
                    }
                  }}
                  label={"Agent"}
                  name={"agentId"}
                >
                  {agents
                    ? Object.entries<LigoloAgent>(agents).map(
                        ([row, agent]) => (
                          <SelectItem
                            key={row}
                            textValue={`${agent.Name} - ${agent.SessionID}`}
                          >
                            {agent.Name} - {agent.SessionID} ({agent.RemoteAddr}
                            )
                          </SelectItem>
                        ),
                      )
                    : null}
                </Select>
                <Input
                  endContent={
                    <EthernetPort className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
                  }
                  label="Agent listening address"
                  placeholder="0.0.0.0:1234"
                  variant="bordered"
                  value={listenerAddr}
                  onValueChange={setListenerAddr}
                  name={"listenerAddr"}
                />
                <Input
                  endContent={
                    <EthernetPort className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
                  }
                  label="Redirect target"
                  placeholder="127.0.0.1:8080"
                  variant="bordered"
                  value={redirectAddr}
                  onValueChange={setRedirectAddr}
                  name={"redirectAddr"}
                />
                <Select
                  defaultSelectedKeys={[listenerProtocol]}
                  onSelectionChange={(keys) => {
                    const nextProtocol = String(keys.currentKey);
                    setListenerProtocol(nextProtocol);
                    if (nextProtocol !== "tcp") setShadowPort(false);
                  }}
                  label="Protocol"
                  placeholder="Protocol"
                >
                  <SelectItem key={"tcp"}>TCP</SelectItem>
                  <SelectItem key={"udp"}>UDP</SelectItem>
                </Select>
                <Checkbox
                  isDisabled={
                    !shadowPortAvailable || listenerProtocol !== "tcp"
                  }
                  isSelected={shadowPort}
                  onValueChange={setShadowPort}
                >
                  ShadowPort (Windows TCP)
                </Checkbox>
                {shadowPortAvailable ? (
                  <p className="text-small text-default-500">
                    Requires an elevated ShadowPort agent. The signed WinDivert
                    driver is extracted only while a ShadowPort listener is
                    active.
                  </p>
                ) : (
                  <p className="text-small text-default-500">
                    Select an agent that advertises ShadowPort support.
                  </p>
                )}
                {shadowPort ? (
                  <>
                    <Input
                      label="Internal port"
                      name="shadowInternalPort"
                      value={shadowInternalPort}
                      onValueChange={setShadowInternalPort}
                      placeholder="8445"
                      variant="bordered"
                    />
                    <Input
                      label="Allowed source IPv4/CIDR"
                      name="shadowSource"
                      value={shadowSource}
                      onValueChange={setShadowSource}
                      placeholder="172.28.0.2,10.10.10.0/24"
                      description="Comma-separated. Other sources continue to the native port owner."
                      variant="bordered"
                    />
                  </>
                ) : null}
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="flat" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onPress={addInterface(onClose)}>
                Add listener
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

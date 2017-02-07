
import sys, datetime, json, logging, uuid, threading
sys.path.append('../bin')
from iothub_client import *

log = logging.getLogger(__name__)

class IOTHub(object):

    def _runHandlerAsync(self, handler, *args, **kwargs):
        log.debug('Running handler in 500ms: %s', handler)
        threading.Timer(0.5, handler, args, kwargs).start()

    def _deviceMethodCallback(self, methodName, payload, context):
        log.debug('Method call: %s, payload: %s', methodName, payload)
        jsonPayload = json.loads(json.loads(payload))
        log.debug('Method call: %s, payload: %s:%s', methodName, type(jsonPayload), jsonPayload)
        response = {}
        responseStatus = 404
        if methodName.lower().startswith('updatefi'):
            operationId = str(uuid.uuid4())
            response = {'operationId':operationId}
            responseStatus = 201
            log.debug('Update firmware. Source: %s, version: %s', jsonPayload['source'], jsonPayload['version'])
            self._runHandlerAsync(self._methodHandler.updateFirmware, jsonPayload['source'], jsonPayload['version'], operationId, self)
            
        deviceMethodReturnValue = DeviceMethodReturnValue()
        deviceMethodReturnValue.response = json.dumps(response)
        deviceMethodReturnValue.status = responseStatus
        return deviceMethodReturnValue

    def _deviceTwinCallback(self, updateState, payLoad, user_context):
        # Notify the configuration object that potentially some of our desired properties have
        # changed. Dependent objects that have registered handlers for any change of config will
        # be notified accordingly.
        jsonPayload = json.loads(payLoad)
        log.debug('Twin callback value: %s', jsonPayload)
        if 'desired' in jsonPayload:
            jsonPayload = jsonPayload['desired']
        self._config.refreshFromTwin(jsonPayload)
        return 0

    def _receiveMessageCallback(self, message, counter):
        return IoTHubMessageDispositionResult.ACCEPTED

    def _sendMessageCallback(self, message, result, context):
        return 0

    def _initializeIotHubClient(self, connectStringVariable):
        self._iotHubClient = IoTHubClient(connectStringVariable.value, IoTHubTransportProvider.MQTT)
        self._iotHubClient.set_option("messageTimeout", 100000)
        self._iotHubClient.set_option("logtrace", 0)
        self._iotHubClient.set_message_callback(self._receiveMessageCallback, 0)
        self._iotHubClient.set_device_twin_callback(self._deviceTwinCallback, 0)
        self._iotHubClient.set_device_method_callback(self._deviceMethodCallback, 0)
        self._messageId = 0

    def __init__(self, connectString, config, methodHandler):
        connectString += self._initializeIotHubClient
        self._initializeIotHubClient(connectString)
        self._config = config
        self._methodHandler = methodHandler

    def _sendEvent(self, payload, messageType):
        message = IoTHubMessage(json.dumps(payload))
        self._messageId += 1
        message.message_id = str(self._messageId)
        message.properties().add('message_type', messageType)
        self._iotHubClient.send_event_async(message, self._sendMessageCallback, 0)

    def sendSessionDetails(self, user, kegIO):
        self._sendEvent({
            'personnelId': user.personnelId,
            'pourDateTime': datetime.datetime.utcnow().isoformat(),
            'taps': [{'tapId': tap.id, 'amount': tap.amount} for tap in kegIO.getTapsFlowCount()]
        }, 'SessionInfo')
        return 0
        
    def sendLogMessage(self, message, logLevel):
        self._sendEvent({
            'message': message,
            'logLevel': logLevel
        }, 'LogMessage')

    def updateProperties(self, payload):
        self._iotHubClient.tw
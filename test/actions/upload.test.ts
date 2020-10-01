import nock from 'nock';
import uploadHook from '../fixtures/webhooks/gitlab/upload.json';
import uploadBinHook from '../fixtures/webhooks/gitlab/upload-bin.json';
import { getChatClass, defaultRoomId } from '../test-utils';
import { Upload } from '../../src/bot/actions/upload';
import { config } from '../../src/config';
import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import { Gitlab } from '../../src/task-trackers/gitlab';
import { UploadData } from '../../src/types';
import { translate } from '../../src/locales';
import marked from 'marked';

const { expect } = chai;
chai.use(sinonChai);

describe('Upload test', () => {
    let chatApi;
    let chatSingle;
    let upload: Upload;
    const gitlabTracker = new Gitlab({ ...config.taskTracker, features: config.features });

    after(() => {
        nock.cleanAll();
    });

    it('Expect upload action works with upload hook and send message with upload info', async () => {
        const uploadData: UploadData = gitlabTracker.parser.getUploadData(uploadHook);
        const chatClass = getChatClass({ alias: uploadData.issueKey });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;

        upload = new Upload(config, gitlabTracker, chatApi);

        const result = await upload.run(uploadData);
        expect(result).to.be.true;
        uploadData.uploadUrls.forEach(element => {
            expect(chatSingle.upload).to.be.calledWithExactly(defaultRoomId, element);
        });
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(
            defaultRoomId,
            uploadData.uploadInfo,
            uploadData.uploadInfo,
        );
    });

    it('Expect sendHtmlMessage not be called if upload is not succeded', async () => {
        const uploadData: UploadData = gitlabTracker.parser.getUploadData(uploadBinHook);
        const chatClass = getChatClass({ alias: uploadData.issueKey });
        chatSingle = chatClass.chatApiSingle;
        chatApi = chatClass.chatApi;

        upload = new Upload(config, gitlabTracker, chatApi);

        chatSingle.upload.resolves(false);

        const result = await upload.run(uploadData);

        expect(result).to.be.true;
        uploadData.uploadUrls.forEach(element => {
            expect(chatSingle.upload).to.be.calledWithExactly(defaultRoomId, element);
        });
        expect(chatSingle.sendHtmlMessage).to.be.calledWithExactly(
            defaultRoomId,
            translate('uploadLink', { url: uploadData.uploadUrls, headerText: uploadData.uploadInfo }),
            marked(translate('uploadLink', { url: uploadData.uploadUrls, headerText: uploadData.uploadInfo })),
        );
    });
});
